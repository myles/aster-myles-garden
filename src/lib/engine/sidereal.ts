// Turns an ephemeris's tropical positions sidereal, by an ayanamsa. Every
// chart goes through here, so transits, progressions, returns and
// composites all follow a chart's zodiac without knowing about it.

import type { Ayanamsa } from "@/lib/astrology/ayanamsa";
import type {
  BodyPosition,
  Ephemeris,
  HousePositions,
} from "@/lib/engine/ephemeris";

import { HouseSystem } from "@/lib/astrology/houses";
import { DEGREES_PER_SIGN, normalizeDegrees } from "@/lib/astrology/zodiac";

/**
 * `ephemeris` itself for the tropical zodiac, when there's no ayanamsa.
 * Otherwise, the same ephemeris with every longitude moved back by the
 * ayanamsa at that moment, as the engine's own sidereal positions are.
 * Speeds aren't adjusted: the ayanamsa grows by about 50″ a year, far
 * below what a chart shows.
 */
export function inZodiac(
  ephemeris: Ephemeris,
  ayanamsa: Ayanamsa | undefined,
): Ephemeris {
  if (!ayanamsa) {
    return ephemeris;
  }

  const shiftAt = (julianDay: number) =>
    ephemeris.calculateAyanamsa(julianDay, ayanamsa);

  return {
    ...ephemeris,
    calculateBodies(julianDay) {
      const shift = shiftAt(julianDay);
      return ephemeris
        .calculateBodies(julianDay)
        .map((position) => toSidereal(position, shift));
    },
    calculateBody(julianDay, body) {
      return toSidereal(
        ephemeris.calculateBody(julianDay, body),
        shiftAt(julianDay),
      );
    },
    calculateHouses(julianDay, latitude, longitude, houseSystem) {
      return toSiderealHouses(
        ephemeris.calculateHouses(julianDay, latitude, longitude, houseSystem),
        shiftAt(julianDay),
      );
    },
  };
}

function toSidereal(position: BodyPosition, shift: number): BodyPosition {
  return Object.assign({}, position, {
    longitude: normalizeDegrees(position.longitude - shift),
  });
}

/**
 * Cusps and angles are points on the ecliptic, so they move back by the
 * ayanamsa too, except whole sign houses, which start on a sign: they're
 * cast afresh from the sidereal sign the ascendant is in.
 */
function toSiderealHouses(
  houses: HousePositions,
  shift: number,
): HousePositions {
  const ascendant = normalizeDegrees(houses.ascendant - shift);
  const midheaven = normalizeDegrees(houses.midheaven - shift);

  if (houses.houseSystem === HouseSystem.WholeSign) {
    const firstCusp =
      Math.floor(ascendant / DEGREES_PER_SIGN) * DEGREES_PER_SIGN;
    return {
      ...houses,
      ascendant,
      midheaven,
      cusps: houses.cusps.map((_, i) =>
        normalizeDegrees(firstCusp + i * DEGREES_PER_SIGN),
      ),
    };
  }

  return {
    ...houses,
    ascendant,
    midheaven,
    cusps: houses.cusps.map((cusp) => normalizeDegrees(cusp - shift)),
  };
}
