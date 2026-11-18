// Secondary progressions: the chart moved on a day for each year of life.
// The sky a day after birth stands for the first birthday, thirty days
// after for the thirtieth, and so on, set against the natal chart as
// transits are.

import type { Chart, PlacedBody } from "@/lib/charts/chart";

import { findAspectsBetween, type Aspect } from "@/lib/astrology/aspects";
import { placeInHouses, type HouseOverlay } from "@/lib/astrology/houses";
import { ChartInputError } from "@/lib/charts/errors";
import { browserEphemeris, type Ephemeris } from "@/lib/engine/ephemeris";
import { inZodiac } from "@/lib/engine/sidereal";
import {
  fromJulianDay,
  toJulianDay,
  toUtc,
  type LocalDate,
  type LocalTime,
} from "@/lib/time";

/**
 * Progressions only count within this many degrees of exact. The
 * progressed Sun moves about a degree a year, so even 1° is two years.
 */
export const PROGRESSION_MAX_ORB_DEGREES = 1;

/** The mean length of the Sun's year, in days. */
const TROPICAL_YEAR_DAYS = 365.242_19;

/**
 * A day of life is about four minutes of progressed sky, so which hour
 * the date is read at hardly matters. Noon UT keeps it the same
 * everywhere.
 */
const READ_AT_TIME: LocalTime = { hour: 12, minute: 0 };
const READ_AT_TIME_ZONE = "UTC";

export type Progressions = {
  natal: Chart;
  /** The date the chart is progressed to. */
  forDate: LocalDate;
  /** The moment whose sky stands for that date, days after birth. */
  skyAt: Date;
  /** Positions at `skyAt`, with no houses of their own. */
  bodies: PlacedBody[];
  /** Each aspect's first body is natal, its second is progressed. */
  aspects: Aspect[];
  /** Undefined when the natal chart has no birth time, so no houses. */
  inNatalHouses?: HouseOverlay;
};

/**
 * Throws for a date before the birth. Requires loadChartEngine() to have
 * resolved, in the browser.
 */
export function createProgressions(
  natal: Chart,
  forDate: LocalDate,
  ephemeris: Ephemeris = browserEphemeris,
): Progressions {
  if (compareDates(forDate, natal.details.date) < 0) {
    throw new ChartInputError("Choose a date from the birth onwards.");
  }

  // On the birth date itself, noon UT can fall a little before the
  // birth; that's a few minutes of progressed sky, so it's left alone.
  const readAt = toUtc({ ...forDate, ...READ_AT_TIME }, READ_AT_TIME_ZONE);
  const yearsLived =
    (toJulianDay(readAt) - natal.julianDay) / TROPICAL_YEAR_DAYS;
  const skyJulianDay = natal.julianDay + yearsLived;

  const bodies = inZodiac(ephemeris, natal.details.ayanamsa)
    .calculateBodies(skyJulianDay)
    .map((position) =>
      Object.assign({}, position, { isRetrograde: position.speed < 0 }),
    );

  return {
    natal,
    forDate,
    skyAt: fromJulianDay(skyJulianDay),
    bodies,
    aspects: findAspectsBetween(
      natal.bodies,
      bodies,
      natal.details.aspectSettings,
      PROGRESSION_MAX_ORB_DEGREES,
    ),
    inNatalHouses: placeInHouses(bodies, natal.houses),
  };
}

/** Negative when `a` comes first, zero on the same day. */
function compareDates(a: LocalDate, b: LocalDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}
