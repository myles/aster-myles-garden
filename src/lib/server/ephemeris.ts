// Server driver for the Swiss Ephemeris, through the native @swisseph/node
// binding. The API's counterpart to src/lib/ephemeris.ts: same domain
// types, same engine codes and flags, so both draw the same chart.

import {
  calculateHouses as calculateSweHouses,
  calculatePosition,
} from "@swisseph/node";

import type { Ephemeris } from "@/lib/ephemeris";

import { Body } from "@/lib/bodies";
import {
  SWE_BODIES,
  SWE_CALCULATION_FLAGS,
  SWE_HOUSE_SYSTEMS,
} from "@/lib/ephemeris-codes";
import { HOUSE_COUNT } from "@/lib/houses";

export const nodeEphemeris: Ephemeris = {
  calculateBodies(julianDay) {
    return Object.values(Body).map((body) => {
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
    });
  },

  calculateHouses(julianDay, latitude, longitude, houseSystem) {
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
    };
  },
};
