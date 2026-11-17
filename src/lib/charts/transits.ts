// Transits: the sky at a chosen moment set against a natal chart. Where
// the planets are then, which natal houses they're crossing, the aspects
// they make to the natal planets, and when each is exact.

import type { Chart, PlacedBody } from "@/lib/charts/chart";

import {
  DEFAULT_ASPECT_SETTINGS,
  findAspectsBetween,
  findOrbLimit,
  type Aspect,
} from "@/lib/astrology/aspects";
import { placeInHouses, type HouseOverlay } from "@/lib/astrology/houses";
import { findBody } from "@/lib/charts/returns";
import {
  findTransitTiming,
  type TransitTiming,
} from "@/lib/charts/transit-timing";
import { browserEphemeris, type Ephemeris } from "@/lib/engine/ephemeris";
import { toJulianDay } from "@/lib/time";

/**
 * Transits only count within this many degrees of exact. Natal orbs of up
 * to 8° would keep the slow planets "in aspect" for months at a time.
 */
export const TRANSIT_MAX_ORB_DEGREES = 2;

/** A transit, with when it's in orb and when it's exact. */
export type TimedAspect = Aspect & { timing: TransitTiming };

export type Transits = {
  natal: Chart;
  at: Date;
  /** Positions at `at`. The sky has no birthplace, so no houses. */
  bodies: PlacedBody[];
  /** Each aspect's first body is natal, its second is transiting. */
  aspects: TimedAspect[];
  /** Undefined when the natal chart has no birth time, so no houses. */
  inNatalHouses?: HouseOverlay;
};

/** Requires loadChartEngine() to have resolved, in the browser. */
export function createTransits(
  natal: Chart,
  at: Date,
  ephemeris: Ephemeris = browserEphemeris,
): Transits {
  const bodies = ephemeris
    .calculateBodies(toJulianDay(at))
    .map((position) =>
      Object.assign({}, position, { isRetrograde: position.speed < 0 }),
    );
  const settings = natal.details.aspectSettings ?? DEFAULT_ASPECT_SETTINGS;

  const aspects = findAspectsBetween(
    natal.bodies,
    bodies,
    settings,
    TRANSIT_MAX_ORB_DEGREES,
  ).map((aspect) =>
    Object.assign(aspect, {
      timing: findTransitTiming(
        aspect,
        findBody(natal.bodies, aspect.first).longitude,
        at,
        findOrbLimit(aspect.type, settings, TRANSIT_MAX_ORB_DEGREES),
        ephemeris,
      ),
    }),
  );

  return {
    natal,
    at,
    bodies,
    aspects,
    inNatalHouses: placeInHouses(bodies, natal.houses),
  };
}
