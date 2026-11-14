// Transits: the sky at a chosen moment set against a natal chart. Where
// the planets are then, which natal houses they're crossing, and the
// aspects they make to the natal planets.

import type { Chart, PlacedBody } from "@/lib/charts/chart";

import { findAspectsBetween, type Aspect } from "@/lib/astrology/aspects";
import { placeInHouses, type HouseOverlay } from "@/lib/astrology/houses";
import { calculateBodies } from "@/lib/engine/ephemeris";
import { toJulianDay } from "@/lib/time";

/**
 * Transits only count within this many degrees of exact. Natal orbs of up
 * to 8° would keep the slow planets "in aspect" for months at a time.
 */
export const TRANSIT_MAX_ORB_DEGREES = 2;

export type Transits = {
  natal: Chart;
  at: Date;
  /** Positions at `at`. The sky has no birthplace, so no houses. */
  bodies: PlacedBody[];
  /** Each aspect's first body is natal, its second is transiting. */
  aspects: Aspect[];
  /** Undefined when the natal chart has no birth time, so no houses. */
  inNatalHouses?: HouseOverlay;
};

/** Requires loadChartEngine() to have resolved. */
export function createTransits(natal: Chart, at: Date): Transits {
  const bodies = calculateBodies(toJulianDay(at)).map((position) =>
    Object.assign({}, position, { isRetrograde: position.speed < 0 }),
  );

  return {
    natal,
    at,
    bodies,
    aspects: findAspectsBetween(
      natal.bodies,
      bodies,
      natal.details.aspectSettings,
      TRANSIT_MAX_ORB_DEGREES,
    ),
    inNatalHouses: placeInHouses(bodies, natal.houses),
  };
}
