// Encodes a chart's birth details as a link, and reads them back, so a
// shared link fills in the form and draws the same chart. Details ride in
// the hash, which browsers never send to the server, so they stay out of
// access logs and Referer headers.
//
// Example: https://aster.myles.garden/#date=2000-01-01&time=12:00
//            &place=2643743&house=placidus

import type { BirthDetails } from "@/lib/chart";
import { DEFAULT_HOUSE_SYSTEM, HouseSystem, isHouseSystem } from "@/lib/houses";
import {
  parseLocalDate,
  parseLocalTime,
  type LocalDate,
  type LocalTime,
} from "@/lib/time";

const DATE_PARAM = "date";
const TIME_PARAM = "time";
const PLACE_PARAM = "place";
const HOUSE_PARAM = "house";

/** Spelled out, so a link that lost its time reads as broken. */
const UNKNOWN_TIME_VALUE = "unknown";

const PLACE_ID_PATTERN = /^[1-9]\d*$/;

/** Form values carried by a share link, as the form's inputs hold them. */
/** One person's birth details, as the form's inputs hold them. */
export type SharedPerson = {
  date: string;
  /** Undefined when the birth time isn't known. */
  time?: string;
  placeId: number;
};

/** Form values carried by a share link. */
export type SharedDetails = SharedPerson & {
  houseSystem: HouseSystem;
  /** The second person, when the link is for a comparison. */
  comparedWith?: SharedPerson;
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
 * Builds a link that reopens a chart, or a comparison when `comparedWith`
 * is given. The house system is shared by both charts.
 */
export function buildShareUrl(
  details: BirthDetails,
  siteUrl: string,
  comparedWith?: BirthDetails,
): string {
  const url = new URL("/", siteUrl);
  const params = new URLSearchParams();

  writePerson(params, details, FIRST_PERSON);
  params.set(HOUSE_PARAM, details.houseSystem);
  if (comparedWith) {
    writePerson(params, comparedWith, SECOND_PERSON);
  }

  // ":" is safe in a hash; leaving it bare keeps "12:00" readable.
  url.hash = params.toString().replaceAll("%3A", ":");

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

  return {
    ...person,
    houseSystem: house,
    comparedWith: readPerson(params, SECOND_PERSON),
  };
}

function writePerson(
  params: URLSearchParams,
  details: BirthDetails,
  person: PersonParams,
): void {
  const time = details.time ? formatTime(details.time) : UNKNOWN_TIME_VALUE;

  params.set(DATE_PARAM + person.suffix, formatDate(details.date));
  params.set(TIME_PARAM + person.suffix, time);
  params.set(PLACE_PARAM + person.suffix, String(details.place.id));
}

/** Undefined when the link has none of this person's fields. */
function readPerson(
  params: URLSearchParams,
  person: PersonParams,
): SharedPerson | undefined {
  const date = params.get(DATE_PARAM + person.suffix);
  const time = params.get(TIME_PARAM + person.suffix);
  const place = params.get(PLACE_PARAM + person.suffix);

  if (date === null && time === null && place === null) {
    return undefined;
  }

  if (date === null || time === null || place === null) {
    throw new Error(`${person.subject} is missing its date, time or place.`);
  }

  const isTimeUnknown = time === UNKNOWN_TIME_VALUE;

  // Throw on a malformed date or time.
  parseLocalDate(date);
  if (!isTimeUnknown) {
    parseLocalTime(time);
  }

  if (!PLACE_ID_PATTERN.test(place)) {
    throw new Error(`${person.possessive} place isn't valid: "${place}".`);
  }

  return {
    date,
    time: isTimeUnknown ? undefined : time,
    placeId: Number(place),
  };
}

/** Example: 1 Jan 2000 → "2000-01-01", as `<input type="date">` holds it. */
function formatDate(date: LocalDate): string {
  const year = String(date.year).padStart(4, "0");
  return `${year}-${pad(date.month)}-${pad(date.day)}`;
}

/** Example: 9:05 → "09:05", as `<input type="time">` holds it. */
function formatTime(time: LocalTime): string {
  return `${pad(time.hour)}:${pad(time.minute)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
