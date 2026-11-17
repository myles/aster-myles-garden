// What solar and lunar returns share: the search for the moment a body
// gets back to its natal longitude, and the choice of showing the return
// on its own or against the natal chart.

import type { Ephemeris } from "@/lib/engine/ephemeris";

import { Body, BODY_INFO } from "@/lib/astrology/bodies";
import { normalizeDegrees } from "@/lib/astrology/zodiac";

const HALF_CIRCLE_DEGREES = 180;

/** Converging takes two or three steps; more means something's wrong. */
const MAX_SEARCH_STEPS = 12;

export enum ReturnStyle {
  Standalone = "standalone",
  BiWheel = "biWheel",
}

export function isReturnStyle(value: string): value is ReturnStyle {
  return Object.values(ReturnStyle).includes(value as ReturnStyle);
}

/**
 * The Julian day near `startJulianDay` when `body` is back at `longitude`,
 * to within `toleranceDegrees`, or undefined if the search doesn't settle.
 * Each step moves by however far the body is off, at the speed it's
 * moving. Its speed barely changes over a step, so each lands far closer.
 */
export function findReturnNear(
  body: Body,
  longitude: number,
  startJulianDay: number,
  toleranceDegrees: number,
  ephemeris: Ephemeris,
): number | undefined {
  let julianDay = startJulianDay;
  for (let step = 0; step < MAX_SEARCH_STEPS; step++) {
    const position = findBody(ephemeris.calculateBodies(julianDay), body);
    const missDegrees = toSignedDegrees(longitude - position.longitude);

    if (Math.abs(missDegrees) < toleranceDegrees) {
      return julianDay;
    }
    julianDay += missDegrees / position.speed;
  }

  return undefined;
}

export function findBody<T extends { body: Body }>(
  positions: T[],
  body: Body,
): T {
  const found = positions.find((position) => position.body === body);
  if (!found) {
    throw new Error(`The chart has no ${BODY_INFO[body].name}.`);
  }
  return found;
}

/** Wraps an angle into [-180, 180), so a miss has the right sign. */
export function toSignedDegrees(degrees: number): number {
  return normalizeDegrees(degrees + HALF_CIRCLE_DEGREES) - HALF_CIRCLE_DEGREES;
}
