// Solar returns: the chart for the moment each year when the Sun gets back
// to exactly where it was at birth, cast for where the person is that
// year. It's read as a forecast for the year until the next one.

import type { Place } from "@/lib/places";

import { Body } from "@/lib/astrology/bodies";
import { normalizeDegrees } from "@/lib/astrology/zodiac";
import {
  canCalculateMoment,
  createChartAt,
  type Chart,
} from "@/lib/charts/chart";
import { browserEphemeris, type Ephemeris } from "@/lib/engine/ephemeris";
import { fromJulianDay, toJulianDay, toLocal } from "@/lib/time";

/** The mean length of the Sun's year, in days. */
const TROPICAL_YEAR_DAYS = 365.242_19;

const HALF_CIRCLE_DEGREES = 180;

/** About a hundredth of a second of the Sun's motion. */
const SUN_TOLERANCE_DEGREES = 1e-7;
/** Converging takes two or three; more means something's wrong. */
const MAX_SEARCH_STEPS = 12;

export enum SolarReturnStyle {
  Standalone = "standalone",
  BiWheel = "biWheel",
}

export function isSolarReturnStyle(value: string): value is SolarReturnStyle {
  return Object.values(SolarReturnStyle).includes(value as SolarReturnStyle);
}

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

  const natalSun = findSun(natal.bodies);

  // Start from the same point in the tropical year, then step by however
  // far the Sun is off, at the speed it's moving. Its speed barely
  // changes over the day or so a step covers, so each lands far closer.
  let julianDay = toJulianDay(birthday);
  for (let step = 0; step < MAX_SEARCH_STEPS; step++) {
    const sun = findSun(ephemeris.calculateBodies(julianDay));
    const missDegrees = toSignedDegrees(natalSun.longitude - sun.longitude);

    if (Math.abs(missDegrees) < SUN_TOLERANCE_DEGREES) {
      return fromJulianDay(julianDay);
    }
    julianDay += missDegrees / sun.speed;
  }

  throw new Error(`Couldn't find the solar return for ${year}.`);
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

function findSun<T extends { body: Body }>(positions: T[]): T {
  const sun = positions.find((position) => position.body === Body.Sun);
  if (!sun) {
    throw new Error("The chart has no Sun.");
  }
  return sun;
}

/** Wraps an angle into [-180, 180), so a miss has the right sign. */
function toSignedDegrees(degrees: number): number {
  return normalizeDegrees(degrees + HALF_CIRCLE_DEGREES) - HALF_CIRCLE_DEGREES;
}
