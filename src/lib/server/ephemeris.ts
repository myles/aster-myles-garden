// Server driver for the Swiss Ephemeris, through the native @swisseph/node
// binding. The API's counterpart to src/lib/engine/ephemeris.ts: same
// domain types, same engine codes and flags, so both draw the same chart.

import {
  calculateHouses as calculateSweHouses,
  calculatePosition,
} from "@swisseph/node";

import type {
  BodyPosition,
  Ephemeris,
  HousePositions,
} from "@/lib/engine/ephemeris";

import { HOUSE_COUNT, type HouseSystem } from "@/lib/astrology/houses";
import {
  calculateEveryBody,
  calculateOneBody,
  SWE_BODIES,
  type SweBody,
  SWE_CALCULATION_FLAGS,
  SWE_HOUSE_SYSTEMS,
  SWE_POLAR_FALLBACK_SYSTEM,
  SWE_POLAR_LIMITED_SYSTEMS,
} from "@/lib/engine/ephemeris-codes";

function castHouses(
  julianDay: number,
  latitude: number,
  longitude: number,
  houseSystem: HouseSystem,
): HousePositions {
  const houses = calculateSweHouses(
    julianDay,
    latitude,
    longitude,
    SWE_HOUSE_SYSTEMS[houseSystem],
  );

  return {
    // Swiss Ephemeris returns cusps 1-indexed; index 0 is unused.
    cusps: houses.cusps.slice(1, HOUSE_COUNT + 1),
    ascendant: houses.ascendant,
    midheaven: houses.mc,
    houseSystem,
  };
}

function calculateSweBody(julianDay: number, body: SweBody): BodyPosition {
  const position = calculatePosition(
    julianDay,
    SWE_BODIES[body],
    SWE_CALCULATION_FLAGS,
  );

  return {
    body,
    longitude: position.longitude,
    latitude: position.latitude,
    speed: position.longitudeSpeed,
  };
}

export const nodeEphemeris: Ephemeris = {
  calculateBodies(julianDay) {
    return calculateEveryBody((body) => calculateSweBody(julianDay, body));
  },

  calculateBody(julianDay, body) {
    return calculateOneBody(body, (sweBody) =>
      calculateSweBody(julianDay, sweBody),
    );
  },

  calculateHouses(julianDay, latitude, longitude, houseSystem) {
    try {
      return castHouses(julianDay, latitude, longitude, houseSystem);
    } catch (error) {
      // The native binding throws where the engine falls back, which only
      // these systems do. Casting the fallback ourselves matches the WASM
      // driver; any other failure is rethrown.
      if (!SWE_POLAR_LIMITED_SYSTEMS.has(houseSystem)) {
        throw error;
      }

      return castHouses(
        julianDay,
        latitude,
        longitude,
        SWE_POLAR_FALLBACK_SYSTEM,
      );
    }
  },
};
