// Driver for the Swiss Ephemeris WASM module. This is the only file that
// talks to @swisseph/browser; everything else works with the domain types
// exported here.

import {
  LunarPoint,
  Planet,
  HouseSystem as SweHouseSystem,
  SwissEphemeris,
} from "@swisseph/browser";
// Resolved by Vite to the hashed asset URL, so dev and build agree.
import DEFAULT_WASM_URL from "@swisseph/browser/dist/swisseph.wasm?url";

import { Body } from "@/lib/bodies";
import { HOUSE_COUNT, HouseSystem } from "@/lib/houses";

export type BodyPosition = {
  body: Body;
  /** Ecliptic longitude, in degrees. */
  longitude: number;
  /** Ecliptic latitude, in degrees. */
  latitude: number;
  /** Change in longitude, in degrees per day. Negative when retrograde. */
  speed: number;
};

export type HousePositions = {
  /** The 12 house cusps in order, starting with the first house. */
  cusps: number[];
  ascendant: number;
  midheaven: number;
};

const SWE_BODIES: Record<Body, Planet | LunarPoint> = {
  [Body.Sun]: Planet.Sun,
  [Body.Moon]: Planet.Moon,
  [Body.Mercury]: Planet.Mercury,
  [Body.Venus]: Planet.Venus,
  [Body.Mars]: Planet.Mars,
  [Body.Jupiter]: Planet.Jupiter,
  [Body.Saturn]: Planet.Saturn,
  [Body.Uranus]: Planet.Uranus,
  [Body.Neptune]: Planet.Neptune,
  [Body.Pluto]: Planet.Pluto,
  [Body.NorthNode]: LunarPoint.TrueNode,
};

const SWE_HOUSE_SYSTEMS: Record<HouseSystem, SweHouseSystem> = {
  [HouseSystem.Placidus]: SweHouseSystem.Placidus,
  [HouseSystem.Koch]: SweHouseSystem.Koch,
  [HouseSystem.WholeSign]: SweHouseSystem.WholeSign,
  [HouseSystem.Equal]: SweHouseSystem.Equal,
  [HouseSystem.Porphyry]: SweHouseSystem.Porphyrius,
  [HouseSystem.Regiomontanus]: SweHouseSystem.Regiomontanus,
  [HouseSystem.Campanus]: SweHouseSystem.Campanus,
};

const _swe = new SwissEphemeris();
let _loading: Promise<void> | undefined;
let _isLoaded = false;

/**
 * Loads and initialises the WASM module. Safe to call repeatedly; the
 * module is fetched once. Pass `wasmUrl` where the bundled asset URL
 * can't be fetched (e.g. tests under Node).
 */
export function loadEphemeris(wasmUrl = DEFAULT_WASM_URL): Promise<void> {
  _loading ??= _swe.init(wasmUrl).then(
    () => {
      _isLoaded = true;
    },
    (error: unknown) => {
      // Allow a retry after a failed fetch instead of caching the failure.
      _loading = undefined;
      throw error;
    },
  );

  return _loading;
}

function _assertLoaded(): void {
  if (!_isLoaded) {
    throw new Error("Ephemeris not loaded; await loadEphemeris() first");
  }
}

/** Geocentric tropical positions for every body, at a Julian day (UT). */
export function calculateBodies(julianDay: number): BodyPosition[] {
  _assertLoaded();

  return Object.values(Body).map((body) => {
    const position = _swe.calculatePosition(julianDay, SWE_BODIES[body]);

    return {
      body,
      longitude: position.longitude,
      latitude: position.latitude,
      speed: position.longitudeSpeed,
    };
  });
}

/**
 * House cusps and angles for a Julian day (UT) and place. Longitude is
 * east-positive. Above the polar circles, Swiss Ephemeris falls back to
 * Porphyry for systems that can't be computed there (e.g. Placidus).
 */
export function calculateHouses(
  julianDay: number,
  latitude: number,
  longitude: number,
  houseSystem: HouseSystem,
): HousePositions {
  _assertLoaded();

  const houses = _swe.calculateHouses(
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
}
