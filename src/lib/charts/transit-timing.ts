// When a transit comes into orb, when it's exact, and when it leaves orb,
// found by following the transiting planet back and forward from the
// moment shown. A planet that turns retrograde can be exact three times
// on one pass, so every exact moment in the window is kept.

import type { Aspect } from "@/lib/astrology/aspects";
import type { Ephemeris } from "@/lib/engine/ephemeris";

import { ASPECT_INFO } from "@/lib/astrology/aspects";
import { Body } from "@/lib/astrology/bodies";
import { toSignedDegrees } from "@/lib/charts/returns";
import {
  SWE_MAX_JULIAN_DAY,
  SWE_MIN_JULIAN_DAY,
} from "@/lib/engine/ephemeris-codes";
import { fromJulianDay, toJulianDay } from "@/lib/time";

export type TransitTiming = {
  /** Undefined when it came into orb more than the search reaches back. */
  entersOrb?: Date;
  /** In order. Empty when the planet turns before reaching exact. */
  exact: Date[];
  /** Undefined when it leaves orb more than the search reaches ahead. */
  leavesOrb?: Date;
};

/**
 * How far back and ahead to look. Pluto, the slowest, can stay within 2°
 * of a point for two or three years as it loops back and forth.
 */
export const TRANSIT_SEARCH_YEARS = 5;
const SEARCH_DAYS = TRANSIT_SEARCH_YEARS * 365.25;

/**
 * The fastest each body moves, in degrees a day, with some to spare. A
 * step is never longer than the body needs to reach an event, so none is
 * stepped over.
 */
const MAX_SPEED_DEGREES_PER_DAY: Record<Body, number> = {
  [Body.Sun]: 1.1,
  [Body.Moon]: 16,
  [Body.Mercury]: 2.5,
  [Body.Venus]: 1.4,
  [Body.Mars]: 0.9,
  [Body.Jupiter]: 0.3,
  [Body.Saturn]: 0.15,
  [Body.Uranus]: 0.08,
  [Body.Neptune]: 0.05,
  [Body.Pluto]: 0.05,
  [Body.NorthNode]: 0.25,
  [Body.SouthNode]: 0.25,
  [Body.Lilith]: 0.15,
};

/**
 * The closest a step goes to an event before stepping past it: a grazing
 * touch nearer than this, as a planet turns, isn't caught.
 */
const RESOLUTION_DEGREES = 0.01;

/** Events are found to within about a minute. */
const BISECTION_DAYS = 1 / (24 * 60);

/**
 * The timing of `aspect`, between a natal body and a transiting one,
 * around `at`. `orbLimit` is how far from exact it still counts; the
 * aspect must be within it at `at`.
 */
export function findTransitTiming(
  aspect: Aspect,
  natalLongitude: number,
  at: Date,
  orbLimit: number,
  ephemeris: Ephemeris,
): TransitTiming {
  const body = aspect.second;
  const maxSpeed = MAX_SPEED_DEGREES_PER_DAY[body];
  const angle = ASPECT_INFO[aspect.type].angleDegrees;
  const startJulianDay = toJulianDay(at);

  const longitudeAt = (julianDay: number) =>
    ephemeris.calculateBody(julianDay, body).longitude;

  // A square, say, is exact 90° either side of the natal body. The point
  // the transiting body is near is the one it's in aspect with.
  const start = longitudeAt(startJulianDay);
  const target = [natalLongitude + angle, natalLongitude - angle].reduce(
    (nearest, point) =>
      Math.abs(toSignedDegrees(start - point)) <
      Math.abs(toSignedDegrees(start - nearest))
        ? point
        : nearest,
  );

  /** Signed: how far past the exact point the body is. */
  const missAt = (julianDay: number) =>
    toSignedDegrees(longitudeAt(julianDay) - target);

  const walk = (direction: 1 | -1) => {
    const exact: number[] = [];
    let julianDay = startJulianDay;
    let miss = missAt(julianDay);

    while (Math.abs(julianDay - startJulianDay) < SEARCH_DAYS) {
      // Far enough to reach neither exact nor the edge of the orb.
      const room = Math.min(Math.abs(miss), orbLimit - Math.abs(miss));
      const step = Math.max(room, RESOLUTION_DEGREES) / maxSpeed;
      const next = julianDay + direction * step;
      if (next < SWE_MIN_JULIAN_DAY || next > SWE_MAX_JULIAN_DAY) {
        break;
      }

      const nextMiss = missAt(next);
      if (Math.sign(nextMiss) !== Math.sign(miss) && miss !== 0) {
        exact.push(bisect(julianDay, next, (day) => Math.sign(missAt(day))));
      }
      if (Math.abs(nextMiss) > orbLimit) {
        const edge = bisect(julianDay, next, (day) =>
          Math.sign(Math.abs(missAt(day)) - orbLimit),
        );
        return { exact, edge };
      }

      julianDay = next;
      miss = nextMiss;
    }

    return { exact, edge: undefined };
  };

  const before = walk(-1);
  const after = walk(1);
  const exact = [...before.exact, ...after.exact].toSorted((a, b) => a - b);

  return {
    entersOrb: toDate(before.edge),
    exact: exact.map(fromJulianDay),
    leavesOrb: toDate(after.edge),
  };
}

/**
 * Narrows the span between two days, where `signAt` differs, to where it
 * changes. Works whichever of the two days comes first.
 */
function bisect(
  from: number,
  to: number,
  signAt: (julianDay: number) => number,
): number {
  let low = from;
  let high = to;
  const lowSign = signAt(low);

  while (Math.abs(high - low) > BISECTION_DAYS) {
    const middle = (low + high) / 2;
    if (signAt(middle) === lowSign) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return (low + high) / 2;
}

function toDate(julianDay: number | undefined): Date | undefined {
  return julianDay === undefined ? undefined : fromJulianDay(julianDay);
}
