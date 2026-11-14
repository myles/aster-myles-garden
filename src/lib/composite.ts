// A composite chart: one chart for a relationship, made from two people's.
// Each body sits at the midpoint of the pair's positions, and the houses
// are cast around the midpoint of their midheavens, at the latitude
// halfway between their birthplaces.

import type { Chart, PlacedBody } from "@/lib/chart";

import { findAspects, type Aspect } from "@/lib/aspects";
import {
  browserEphemeris,
  type Ephemeris,
  type HousePositions,
} from "@/lib/ephemeris";
import { findHouse } from "@/lib/houses";
import { normalizeDegrees } from "@/lib/zodiac";

const HALF_CIRCLE_DEGREES = 180;

/** Far finer than the minute of arc a chart shows. */
const MIDHEAVEN_TOLERANCE_DEGREES = 1e-7;
/** Converging takes about seven; more means something's wrong. */
const MAX_MIDHEAVEN_PASSES = 20;

export type Composite = {
  /** "You": whose house system and aspect settings it uses. */
  first: Chart;
  /** "Them". */
  second: Chart;
  bodies: PlacedBody[];
  /** Undefined when either chart has no birth time, so no houses. */
  houses?: HousePositions;
  aspects: Aspect[];
};

/**
 * The midpoint on the shorter arc between two longitudes. Exactly
 * opposite longitudes have two; this takes the one 90° past `a`.
 * Example: 350° and 20° → 5°, not 185°.
 */
export function findMidpoint(a: number, b: number): number {
  let arc = normalizeDegrees(b - a);
  if (arc > HALF_CIRCLE_DEGREES) {
    arc -= 2 * HALF_CIRCLE_DEGREES;
  }

  return normalizeDegrees(a + arc / 2);
}

/**
 * Builds the composite of two charts. In the browser, requires
 * loadChartEngine() to have resolved; the server passes its own driver.
 */
export function createComposite(
  first: Chart,
  second: Chart,
  ephemeris: Ephemeris = browserEphemeris,
): Composite {
  const houses = castHouses(first, second, ephemeris);
  const bodies = first.bodies.map((placed, index) => {
    const other = second.bodies[index];
    const longitude = findMidpoint(placed.longitude, other.longitude);

    return {
      body: placed.body,
      longitude,
      latitude: (placed.latitude + other.latitude) / 2,
      // A composite isn't a moment in time, so nothing in it moves.
      speed: 0,
      isRetrograde: false,
      house: houses && findHouse(longitude, houses.cusps),
    };
  });

  return {
    first,
    second,
    bodies,
    houses,
    aspects: findAspects(bodies, first.details.aspectSettings),
  };
}

function castHouses(
  first: Chart,
  second: Chart,
  ephemeris: Ephemeris,
): HousePositions | undefined {
  if (!first.houses || !second.houses) {
    return undefined;
  }

  // The moment only sets the tilt of the Earth's axis, which barely
  // changes over a lifetime, so the midpoint of the two serves.
  const julianDay = (first.julianDay + second.julianDay) / 2;
  const latitude =
    (first.details.place.latitude + second.details.place.latitude) / 2;
  const midheaven = findMidpoint(
    first.houses.midheaven,
    second.houses.midheaven,
  );
  const { houseSystem } = first.details;

  // The engine casts houses for a place, not a midheaven. Moving east by
  // some degrees moves the midheaven by about as many, so cast, shift the
  // longitude by however far the midheaven missed, and repeat. Each pass
  // cuts the miss about tenfold.
  let longitude = 0;
  for (let pass = 0; pass < MAX_MIDHEAVEN_PASSES; pass++) {
    const houses = ephemeris.calculateHouses(
      julianDay,
      latitude,
      longitude,
      houseSystem,
    );
    const missDegrees = toSignedDegrees(midheaven - houses.midheaven);

    if (Math.abs(missDegrees) < MIDHEAVEN_TOLERANCE_DEGREES) {
      return houses;
    }
    longitude = toSignedDegrees(longitude + missDegrees);
  }

  throw new Error("Couldn't cast the composite's houses.");
}

/** Wraps an angle into [-180, 180), the range longitudes take. */
function toSignedDegrees(degrees: number): number {
  return normalizeDegrees(degrees + HALF_CIRCLE_DEGREES) - HALF_CIRCLE_DEGREES;
}
