// Solar returns: the chart for the moment each year when the Sun gets back
// to exactly where it was at birth, cast for where the person is that
// year. It's read as a forecast for the year until the next one.

import type { Place } from "@/lib/places";

import { Body } from "@/lib/astrology/bodies";
import {
  canCalculateMoment,
  createChartAt,
  type Chart,
} from "@/lib/charts/chart";
import { findBody, findReturnNear } from "@/lib/charts/returns";
import { browserEphemeris, type Ephemeris } from "@/lib/engine/ephemeris";
import { inZodiac } from "@/lib/engine/sidereal";
import { fromJulianDay, toJulianDay, toLocal } from "@/lib/time";

/** The mean length of the Sun's year, in days. */
const TROPICAL_YEAR_DAYS = 365.242_19;

/** About a hundredth of a second of the Sun's motion. */
const SUN_TOLERANCE_DEGREES = 1e-7;

export type SolarReturn = {
  natal: Chart;
  /** The year of the birthday the return falls on, give or take a day. */
  year: number;
  /** Cast for the return's moment and place. */
  chart: Chart;
};

/**
 * The moment the Sun returns to its natal position in `year`. Throws
 * without a birth time, which fixes the natal Sun to the minute, for a
 * year that isn't after the birth year, and outside the engine's range.
 */
export function findSolarReturn(
  natal: Chart,
  year: number,
  ephemeris: Ephemeris = browserEphemeris,
): Date {
  if (!natal.details.time) {
    throw new Error(
      "A solar return needs the birth time: without it, the natal Sun " +
        "could be anywhere in a day's worth of its path.",
    );
  }

  const birthYear = natal.details.date.year;
  if (year <= birthYear) {
    throw new Error(`Choose a year after ${birthYear}, the year of birth.`);
  }

  const birthday = fromJulianDay(
    natal.julianDay + (year - birthYear) * TROPICAL_YEAR_DAYS,
  );
  if (!canCalculateMoment(birthday)) {
    throw new Error(
      "Solar returns can only be found from about 3000 BCE to 3000 CE.",
    );
  }

  // Start from the same point in the tropical year.
  const natalSun = findBody(natal.bodies, Body.Sun);
  const julianDay = findReturnNear(
    Body.Sun,
    natalSun.longitude,
    toJulianDay(birthday),
    SUN_TOLERANCE_DEGREES,
    inZodiac(ephemeris, natal.details.ayanamsa),
  );
  if (julianDay === undefined) {
    throw new Error(`Couldn't find the solar return for ${year}.`);
  }

  return fromJulianDay(julianDay);
}

/** Requires loadChartEngine() to have resolved, in the browser. */
export function createSolarReturn(
  natal: Chart,
  year: number,
  place: Place,
  ephemeris: Ephemeris = browserEphemeris,
): SolarReturn {
  const at = findSolarReturn(natal, year, ephemeris);
  const local = toLocal(at, place.timeZone);
  const details = {
    ...natal.details,
    date: { year: local.year, month: local.month, day: local.day },
    time: { hour: local.hour, minute: local.minute },
    place,
  };

  return { natal, year, chart: createChartAt(details, at, ephemeris) };
}

/**
 * The year of the return in effect at `now`: the latest whose moment has
 * passed, or in the year of birth, the first one, still ahead. Next
 * year's is checked too: a return can come a day before its birthday,
 * so before New Year.
 */
export function findCurrentReturnYear(
  natal: Chart,
  now: Date,
  ephemeris: Ephemeris = browserEphemeris,
): number {
  const firstYear = natal.details.date.year + 1;

  for (let year = now.getUTCFullYear() + 1; year > firstYear; year--) {
    if (findSolarReturn(natal, year, ephemeris) <= now) {
      return year;
    }
  }

  return firstYear;
}
