// Lunar returns: the chart for the moment the Moon gets back to exactly
// where it was at birth, which happens about every 27 days. Cast for
// where the person is at the time, it's read for the month until the
// next one.

import type { Place } from "@/lib/places";

import { Body } from "@/lib/astrology/bodies";
import { normalizeDegrees } from "@/lib/astrology/zodiac";
import {
  canCalculateMoment,
  createChartAt,
  type Chart,
} from "@/lib/charts/chart";
import { findBody, findReturnNear } from "@/lib/charts/returns";
import { browserEphemeris, type Ephemeris } from "@/lib/engine/ephemeris";
import {
  fromJulianDay,
  toJulianDay,
  toLocal,
  toUtc,
  type LocalDate,
} from "@/lib/time";

/** The mean time the Moon takes to get back to the same longitude. */
const SIDEREAL_MONTH_DAYS = 27.321_661;

/** About a tenth of a second of the Moon's motion. */
const MOON_TOLERANCE_DEGREES = 1e-6;

export type LunarReturn = {
  natal: Chart;
  /** Cast for the return's moment and place. */
  chart: Chart;
};

/**
 * The latest moment before `by` when the Moon was back at its natal
 * position. Throws without a birth time, which fixes the natal Moon to
 * within a few seconds of arc, before the first return, about four weeks
 * after birth, and outside the engine's range.
 */
export function findLunarReturn(
  natal: Chart,
  by: Date,
  ephemeris: Ephemeris = browserEphemeris,
): Date {
  if (!natal.details.time) {
    throw new Error(
      "A lunar return needs the birth time: the Moon moves about 13° a " +
        "day, so without it, the natal Moon could be anywhere in that.",
    );
  }

  const byJulianDay = toJulianDay(by);
  const monthBefore = fromJulianDay(byJulianDay - SIDEREAL_MONTH_DAYS);
  if (!canCalculateMoment(by) || !canCalculateMoment(monthBefore)) {
    throw new Error(
      "Lunar returns can only be found from about 3000 BCE to 3000 CE.",
    );
  }

  const natalMoon = findBody(natal.bodies, Body.Moon);
  const findNear = (julianDay: number) => {
    const found = findReturnNear(
      Body.Moon,
      natalMoon.longitude,
      julianDay,
      MOON_TOLERANCE_DEGREES,
      ephemeris,
    );
    if (found === undefined) {
      throw new Error("Couldn't find the lunar return.");
    }
    return found;
  };

  // Start from how far the Moon has come since it last passed its natal
  // position, at the speed it's moving now.
  const moon = findBody(ephemeris.calculateBodies(byJulianDay), Body.Moon);
  const sinceDegrees = normalizeDegrees(moon.longitude - natalMoon.longitude);
  let julianDay = findNear(byJulianDay - sinceDegrees / moon.speed);

  // The Moon's speed changes by a fifth over a month, so the search can
  // settle on a neighbouring return. Step back, or forward, by a month.
  while (julianDay >= byJulianDay) {
    julianDay = findNear(julianDay - SIDEREAL_MONTH_DAYS);
  }
  const next = findNear(julianDay + SIDEREAL_MONTH_DAYS);
  if (next < byJulianDay) {
    julianDay = next;
  }

  // The birth itself is the Moon at its natal position, but not a return.
  if (julianDay < natal.julianDay + SIDEREAL_MONTH_DAYS / 2) {
    throw new Error(
      "The first lunar return comes about four weeks after birth. " +
        "Choose a date from then on.",
    );
  }

  return fromJulianDay(julianDay);
}

/**
 * The lunar return in effect on `date` where it's cast: the latest to
 * come before that day ends there. Asked for the day a return comes on,
 * that's the one. Requires loadChartEngine() to have resolved, in the
 * browser.
 */
export function createLunarReturn(
  natal: Chart,
  date: LocalDate,
  place: Place,
  ephemeris: Ephemeris = browserEphemeris,
): LunarReturn {
  const dayEnds = toUtc(
    { ...findNextDay(date), hour: 0, minute: 0 },
    place.timeZone,
  );
  const at = findLunarReturn(natal, dayEnds, ephemeris);
  const local = toLocal(at, place.timeZone);
  const details = {
    ...natal.details,
    date: { year: local.year, month: local.month, day: local.day },
    time: { hour: local.hour, minute: local.minute },
    place,
  };

  return { natal, chart: createChartAt(details, at, ephemeris) };
}

/** Months and years roll over as a calendar's do. */
function findNextDay({ year, month, day }: LocalDate): LocalDate {
  // setUTCFullYear, unlike Date.UTC, reads years 0 to 99 as written.
  const next = new Date(0);
  next.setUTCFullYear(year, month - 1, day + 1);

  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}
