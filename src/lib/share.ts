// Encodes a chart's birth details as a link, and reads them back, so a
// shared link fills in the form and draws the same chart. Details ride in
// the hash, which browsers never send to the server, so they stay out of
// access logs and Referer headers.
//
// Example: https://aster.myles.garden/#date=2000-01-01&time=12:00
//            &place=2643743&house=placidus

import type { BirthDetails } from "@/lib/chart";

import {
  DEFAULT_ASPECT_SETTINGS,
  isAspectSet,
  isOrbSize,
  type AspectSettings,
} from "@/lib/aspects";
import { formatCoordinates } from "@/lib/format";
import { DEFAULT_HOUSE_SYSTEM, HouseSystem, isHouseSystem } from "@/lib/houses";
import {
  createCoordinatePlace,
  parseCoordinates,
  type Place,
} from "@/lib/places";
import { SolarReturnStyle } from "@/lib/solar-return";
import { ComparisonStyle, isComparisonStyle } from "@/lib/synastry";
import {
  formatDateValue,
  formatTimeValue,
  isTimeZone,
  parseLocalDate,
  parseLocalDateTime,
  parseLocalTime,
  toUtc,
} from "@/lib/time";

const DATE_PARAM = "date";
const TIME_PARAM = "time";
const PLACE_PARAM = "place";
// A place entered by coordinates, which has no GeoNames ID.
const LATITUDE_PARAM = "lat";
const LONGITUDE_PARAM = "lon";
const TIME_ZONE_PARAM = "tz";
const PLACE_NAME_PARAM = "name";
const HOUSE_PARAM = "house";
// Aspect settings, written only when they aren't the default.
const ASPECTS_PARAM = "aspects";
const ORBS_PARAM = "orbs";
const TRANSITS_PARAM = "transits";
// How a comparison is shown, written only when it isn't the bi-wheel.
const COMPARISON_PARAM = "comparison";
const RETURN_PARAM = "return";
const RETURN_STYLE_PARAM = "returnStyle";

/** A solar return's year: 1 CE onwards. */
const YEAR_PATTERN = /^[1-9]\d{0,3}$/;

/** A transit moment in UTC, to the minute. Example: "2026-11-13T20:05Z". */
const TRANSITS_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})Z$/;
const MINUTE_ISO_LENGTH = "2026-11-13T20:05".length;
const TRANSITS_TIME_ZONE = "UTC";

/** Spelled out, so a link that lost its time reads as broken. */
const UNKNOWN_TIME_VALUE = "unknown";

const PLACE_ID_PATTERN = /^[1-9]\d*$/;

/**
 * A place carried by a share link. A listed place comes as its GeoNames
 * ID, to look up; a place entered by its coordinates comes whole.
 */
export type SharedPlace = { placeId: number } | { place: Place };

/** One person's birth details, as the form's inputs hold them. */
export type SharedPerson = {
  date: string;
  /** Undefined when the birth time isn't known. */
  time?: string;
} & SharedPlace;

/** Form values carried by a share link. */
export type SharedDetails = SharedPerson & {
  houseSystem: HouseSystem;
  aspectSettings: AspectSettings;
  /** The second person, when the link is for a comparison. */
  comparedWith?: SharedPerson;
  /** Only when the link shows a comparison other than the bi-wheel. */
  comparisonStyle?: ComparisonStyle;
  /** The moment to show transits for, when the link is for transits. */
  transitsAt?: Date;
  /** When the link is for a solar return. No place means the birthplace. */
  solarReturn?: {
    year: number;
    place?: SharedPlace;
    style?: SolarReturnStyle;
  };
};

/**
 * What a link can add to a chart: one of a comparison, transits or a
 * solar return.
 */
export type ShareAddition = {
  comparedWith?: BirthDetails;
  /** How the comparison is shown. Undefined means the bi-wheel. */
  comparisonStyle?: ComparisonStyle;
  transitsAt?: Date;
  solarReturn?: { year: number; place: Place; style?: SolarReturnStyle };
};

/** How a person's fields are named in a link and in its errors. */
type PersonParams = {
  suffix: string;
  subject: string;
  possessive: string;
};

const FIRST_PERSON: PersonParams = {
  suffix: "",
  subject: "The link",
  possessive: "The link's",
};

/** A comparison's second person: "date2", "time2" and "place2". */
const SECOND_PERSON: PersonParams = {
  suffix: "2",
  subject: "The link's second chart",
  possessive: "The second chart's",
};

/** Where a solar return is cast: "place_return", "lat_return" and so on. */
const RETURN_PLACE: PersonParams = {
  suffix: "_return",
  subject: "The link's solar return",
  possessive: "The solar return's",
};

/**
 * Builds a link that reopens a chart, along with a comparison or transits
 * when the addition names one. A comparison shares the house system and
 * aspect settings.
 */
export function buildShareUrl(
  details: BirthDetails,
  siteUrl: string,
  {
    comparedWith,
    comparisonStyle,
    transitsAt,
    solarReturn,
  }: ShareAddition = {},
): string {
  const url = new URL("/", siteUrl);
  const params = new URLSearchParams();

  writePerson(params, details, FIRST_PERSON);
  params.set(HOUSE_PARAM, details.houseSystem);
  writeAspectSettings(params, details.aspectSettings);
  if (comparedWith) {
    writePerson(params, comparedWith, SECOND_PERSON);
  }
  if (comparedWith && comparisonStyle === ComparisonStyle.Composite) {
    params.set(COMPARISON_PARAM, comparisonStyle);
  }
  if (solarReturn) {
    params.set(RETURN_PARAM, String(solarReturn.year));
    if (solarReturn.style === SolarReturnStyle.BiWheel) {
      params.set(RETURN_STYLE_PARAM, solarReturn.style);
    }
    if (!isSamePlace(solarReturn.place, details.place)) {
      writePlace(params, solarReturn.place, RETURN_PLACE);
    }
  }
  if (transitsAt) {
    const minute = transitsAt.toISOString().slice(0, MINUTE_ISO_LENGTH);
    params.set(TRANSITS_PARAM, `${minute}Z`);
  }

  // ":" and "/" are safe in a hash; leaving them bare keeps "12:00" and
  // "America/Toronto" readable.
  url.hash = params.toString().replaceAll("%3A", ":").replaceAll("%2F", "/");

  return url.toString();
}

/**
 * Reads share-link details from a URL hash. Returns undefined when
 * the page wasn't opened from a share link, and throws when it was but
 * the link is damaged. A missing house system or aspect setting falls
 * back to the default.
 */
export function parseShareHash(hash: string): SharedDetails | undefined {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const person = readPerson(params, FIRST_PERSON);

  if (!person) {
    return undefined;
  }

  const house = params.get(HOUSE_PARAM) ?? DEFAULT_HOUSE_SYSTEM;
  if (!isHouseSystem(house)) {
    throw new Error(`The link's house system isn't known: "${house}".`);
  }

  const aspectSettings = readAspectSettings(params);
  const comparedWith = readPerson(params, SECOND_PERSON);
  const comparisonStyle = readComparisonStyle(params, comparedWith);
  const transitsAt = readTransitsAt(params);
  const solarReturn = readSolarReturn(params);

  const additions = [comparedWith, transitsAt, solarReturn].filter(Boolean);
  if (additions.length > 1) {
    throw new Error(
      "The link can show only one of a comparison, transits or a solar return.",
    );
  }

  return {
    ...person,
    houseSystem: house,
    aspectSettings,
    comparedWith,
    comparisonStyle,
    transitsAt,
    solarReturn,
  };
}

/** Undefined when the link isn't for a solar return. */
function readSolarReturn(
  params: URLSearchParams,
): SharedDetails["solarReturn"] {
  const year = params.get(RETURN_PARAM);
  const style = params.get(RETURN_STYLE_PARAM);
  if (year === null) {
    if (style !== null) {
      throw new Error("A solar return style needs a solar return year.");
    }
    return undefined;
  }

  if (!YEAR_PATTERN.test(year)) {
    throw new Error(`The solar return's year isn't valid: "${year}".`);
  }

  const place = readPlace(params, RETURN_PLACE);
  if (!place && hasPlaceField(params, RETURN_PLACE)) {
    throw new Error(`${RETURN_PLACE.subject} is missing its place.`);
  }

  if (
    style !== null &&
    style !== SolarReturnStyle.Standalone &&
    style !== SolarReturnStyle.BiWheel
  ) {
    throw new Error("Unknown solar return style.");
  }

  return { year: Number(year), place, style: style ?? undefined };
}

/** Listed places match by ID; places entered by coordinates, whole. */
function isSamePlace(a: Place, b: Place): boolean {
  if (a.id !== undefined || b.id !== undefined) {
    return a.id === b.id;
  }

  return (
    a.latitude === b.latitude &&
    a.longitude === b.longitude &&
    a.timeZone === b.timeZone &&
    a.name === b.name
  );
}

/** Undefined when the link doesn't choose how a comparison is shown. */
function readComparisonStyle(
  params: URLSearchParams,
  comparedWith: SharedPerson | undefined,
): ComparisonStyle | undefined {
  const value = params.get(COMPARISON_PARAM);
  if (value === null) {
    return undefined;
  }

  if (!isComparisonStyle(value)) {
    throw new Error(`The link's comparison isn't known: "${value}".`);
  }
  if (!comparedWith) {
    throw new Error("The link chooses a comparison but has no second chart.");
  }

  return value;
}

/** Old links, and links with the default settings, have neither param. */
function writeAspectSettings(
  params: URLSearchParams,
  settings = DEFAULT_ASPECT_SETTINGS,
): void {
  if (settings.aspectSet !== DEFAULT_ASPECT_SETTINGS.aspectSet) {
    params.set(ASPECTS_PARAM, settings.aspectSet);
  }
  if (settings.orbSize !== DEFAULT_ASPECT_SETTINGS.orbSize) {
    params.set(ORBS_PARAM, settings.orbSize);
  }
}

function readAspectSettings(params: URLSearchParams): AspectSettings {
  const aspectSet =
    params.get(ASPECTS_PARAM) ?? DEFAULT_ASPECT_SETTINGS.aspectSet;
  if (!isAspectSet(aspectSet)) {
    throw new Error(
      `The link's choice of aspects isn't known: "${aspectSet}".`,
    );
  }

  const orbSize = params.get(ORBS_PARAM) ?? DEFAULT_ASPECT_SETTINGS.orbSize;
  if (!isOrbSize(orbSize)) {
    throw new Error(`The link's orbs aren't known: "${orbSize}".`);
  }

  return { aspectSet, orbSize };
}

/** Undefined when the link isn't for transits. */
function readTransitsAt(params: URLSearchParams): Date | undefined {
  const value = params.get(TRANSITS_PARAM);
  if (value === null) {
    return undefined;
  }

  const invalidMessage = `The link's transit moment isn't valid: "${value}".`;
  const match = TRANSITS_PATTERN.exec(value);
  if (!match) {
    throw new Error(invalidMessage);
  }

  // Read through the date and time parsers, since Date rolls an
  // impossible moment such as 31 February into the next month.
  try {
    return toUtc(parseLocalDateTime(match[1], match[2]), TRANSITS_TIME_ZONE);
  } catch (cause) {
    throw new Error(invalidMessage, { cause });
  }
}

function writePerson(
  params: URLSearchParams,
  details: BirthDetails,
  person: PersonParams,
): void {
  const time = details.time
    ? formatTimeValue(details.time)
    : UNKNOWN_TIME_VALUE;

  params.set(DATE_PARAM + person.suffix, formatDateValue(details.date));
  params.set(TIME_PARAM + person.suffix, time);
  writePlace(params, details.place, person);
}

function writePlace(
  params: URLSearchParams,
  place: Place,
  person: PersonParams,
): void {
  if (place.id !== undefined) {
    params.set(PLACE_PARAM + person.suffix, String(place.id));
    return;
  }

  const { latitude, longitude, timeZone, name } = place;
  params.set(LATITUDE_PARAM + person.suffix, String(latitude));
  params.set(LONGITUDE_PARAM + person.suffix, String(longitude));
  params.set(TIME_ZONE_PARAM + person.suffix, timeZone);

  // A place named only by its coordinates gets that name back on reading.
  if (name !== formatCoordinates(latitude, longitude)) {
    params.set(PLACE_NAME_PARAM + person.suffix, name);
  }
}

/** Undefined when the link has none of this person's fields. */
function readPerson(
  params: URLSearchParams,
  person: PersonParams,
): SharedPerson | undefined {
  const date = params.get(DATE_PARAM + person.suffix);
  const time = params.get(TIME_PARAM + person.suffix);

  if (date === null && time === null && !hasPlaceField(params, person)) {
    return undefined;
  }

  const place = readPlace(params, person);
  if (date === null || time === null || !place) {
    throw new Error(`${person.subject} is missing its date, time or place.`);
  }

  const isTimeUnknown = time === UNKNOWN_TIME_VALUE;

  // Throw on a malformed date or time.
  parseLocalDate(date);
  if (!isTimeUnknown) {
    parseLocalTime(time);
  }

  return { date, time: isTimeUnknown ? undefined : time, ...place };
}

/** Whether the link has any of the fields that name this place. */
function hasPlaceField(params: URLSearchParams, person: PersonParams): boolean {
  return [PLACE_PARAM, LATITUDE_PARAM, LONGITUDE_PARAM, TIME_ZONE_PARAM].some(
    (name) => params.get(name + person.suffix) !== null,
  );
}

/** Undefined when the link doesn't fully name this place. */
function readPlace(
  params: URLSearchParams,
  person: PersonParams,
): SharedPlace | undefined {
  const read = (name: string) => params.get(name + person.suffix);
  const placeId = read(PLACE_PARAM);
  const latitude = read(LATITUDE_PARAM);
  const longitude = read(LONGITUDE_PARAM);
  const timeZone = read(TIME_ZONE_PARAM);

  if (placeId !== null) {
    if (!PLACE_ID_PATTERN.test(placeId)) {
      throw new Error(`${person.possessive} place isn't valid: "${placeId}".`);
    }
    return { placeId: Number(placeId) };
  }

  if (latitude === null || longitude === null || timeZone === null) {
    return undefined;
  }

  if (!isTimeZone(timeZone)) {
    throw new Error(
      `${person.possessive} time zone isn't known: "${timeZone}".`,
    );
  }

  const coordinates = parseCoordinates(`${latitude}, ${longitude}`);
  const place = createCoordinatePlace({
    ...coordinates,
    name: read(PLACE_NAME_PARAM) ?? "",
    timeZone,
  });

  return { place };
}
