// Encodes a chart's birth details as a link, and reads them back, so a
// shared link fills in the form and draws the same chart. Details ride in
// the hash, which browsers never send to the server, so they stay out of
// access logs and Referer headers.
//
// Example: https://aster.myles.garden/#date=2000-01-01&time=12:00
//            &place=2643743&house=placidus

import type { BirthDetails } from "@/lib/chart";
import { formatCoordinates } from "@/lib/format";
import { DEFAULT_HOUSE_SYSTEM, HouseSystem, isHouseSystem } from "@/lib/houses";
import {
  createCoordinatePlace,
  parseCoordinates,
  type Place,
} from "@/lib/places";
import {
  formatDateValue,
  formatTimeValue,
  isTimeZone,
  parseLocalDate,
  parseLocalTime,
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
const TRANSITS_PARAM = "transits";

/** A transit moment in UTC, to the minute. Example: "2026-11-13T20:05Z". */
const TRANSITS_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/;
const MINUTE_ISO_LENGTH = "2026-11-13T20:05".length;

/** Spelled out, so a link that lost its time reads as broken. */
const UNKNOWN_TIME_VALUE = "unknown";

const PLACE_ID_PATTERN = /^[1-9]\d*$/;

/** Form values carried by a share link, as the form's inputs hold them. */
/**
 * One person's birth details, as the form's inputs hold them. A listed
 * place comes as its GeoNames ID, to look up; a place entered by its
 * coordinates comes whole.
 */
export type SharedPerson = {
  date: string;
  /** Undefined when the birth time isn't known. */
  time?: string;
} & ({ placeId: number } | { place: Place });

/** Form values carried by a share link. */
export type SharedDetails = SharedPerson & {
  houseSystem: HouseSystem;
  /** The second person, when the link is for a comparison. */
  comparedWith?: SharedPerson;
  /** The moment to show transits for, when the link is for transits. */
  transitsAt?: Date;
};

/** What a link can add to a chart: a comparison or transits, not both. */
export type ShareAddition = {
  comparedWith?: BirthDetails;
  transitsAt?: Date;
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

/**
 * Builds a link that reopens a chart, along with a comparison or transits
 * when the addition names one. A comparison shares the house system.
 */
export function buildShareUrl(
  details: BirthDetails,
  siteUrl: string,
  { comparedWith, transitsAt }: ShareAddition = {},
): string {
  const url = new URL("/", siteUrl);
  const params = new URLSearchParams();

  writePerson(params, details, FIRST_PERSON);
  params.set(HOUSE_PARAM, details.houseSystem);
  if (comparedWith) {
    writePerson(params, comparedWith, SECOND_PERSON);
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
 * the link is damaged. A missing house system falls back to the default.
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

  const comparedWith = readPerson(params, SECOND_PERSON);
  const transitsAt = readTransitsAt(params);

  if (comparedWith && transitsAt) {
    throw new Error("The link can't show both a comparison and transits.");
  }

  return { ...person, houseSystem: house, comparedWith, transitsAt };
}

/** Undefined when the link isn't for transits. */
function readTransitsAt(params: URLSearchParams): Date | undefined {
  const value = params.get(TRANSITS_PARAM);
  if (value === null) {
    return undefined;
  }

  const at = new Date(value);
  if (!TRANSITS_PATTERN.test(value) || Number.isNaN(at.getTime())) {
    throw new Error(`The link's transit moment isn't valid: "${value}".`);
  }

  return at;
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
  const read = (name: string) => params.get(name + person.suffix);
  const date = read(DATE_PARAM);
  const time = read(TIME_PARAM);
  const placeId = read(PLACE_PARAM);
  const latitude = read(LATITUDE_PARAM);
  const longitude = read(LONGITUDE_PARAM);
  const timeZone = read(TIME_ZONE_PARAM);
  const hasCoordinates =
    latitude !== null && longitude !== null && timeZone !== null;

  const fields = [date, time, placeId, latitude, longitude, timeZone];
  if (fields.every((field) => field === null)) {
    return undefined;
  }

  if (date === null || time === null || (placeId === null && !hasCoordinates)) {
    throw new Error(`${person.subject} is missing its date, time or place.`);
  }

  const isTimeUnknown = time === UNKNOWN_TIME_VALUE;

  // Throw on a malformed date or time.
  parseLocalDate(date);
  if (!isTimeUnknown) {
    parseLocalTime(time);
  }

  const birth = { date, time: isTimeUnknown ? undefined : time };

  if (placeId !== null) {
    if (!PLACE_ID_PATTERN.test(placeId)) {
      throw new Error(`${person.possessive} place isn't valid: "${placeId}".`);
    }
    return { ...birth, placeId: Number(placeId) };
  }

  // hasCoordinates holds here, so none of the three is null.
  if (!isTimeZone(timeZone!)) {
    throw new Error(
      `${person.possessive} time zone isn't known: "${timeZone}".`,
    );
  }

  const coordinates = parseCoordinates(`${latitude}, ${longitude}`);
  const place = createCoordinatePlace({
    ...coordinates,
    name: read(PLACE_NAME_PARAM) ?? "",
    timeZone: timeZone!,
  });

  return { ...birth, place };
}
