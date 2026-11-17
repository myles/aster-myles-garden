// Driver for the Swiss Ephemeris WASM module. This is the only file that
// talks to @swisseph/browser; everything else works with the domain types
// exported here.

import { SwissEphemeris } from "@swisseph/browser";
// Resolved by Vite to the hashed asset URL, so dev and build agree.
import DEFAULT_WASM_URL from "@swisseph/browser/dist/swisseph.wasm?url";

import { Body } from "@/lib/astrology/bodies";
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
  /**
   * The system the cusps were cast with: Porphyry, inside the polar
   * circles, when the one asked for can't be cast there.
   */
  houseSystem: HouseSystem;
};

/**
 * What the chart service needs from an ephemeris. The browser and server
 * each have a driver; both use the Moshier ephemeris, so they agree.
 */
export type Ephemeris = {
  calculateBodies(julianDay: number): BodyPosition[];
  /** One body's position: the same as its entry in calculateBodies. */
  calculateBody(julianDay: number, body: Body): BodyPosition;
  calculateHouses(
    julianDay: number,
    latitude: number,
    longitude: number,
    houseSystem: HouseSystem,
  ): HousePositions;
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
      return undefined;
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

  return calculateEveryBody((body) => calculateSweBody(julianDay, body));
}

/**
 * One body's position, for searches that follow a single body through
 * many moments and would waste the rest of calculateBodies' work.
 */
export function calculateBody(julianDay: number, body: Body): BodyPosition {
  _assertLoaded();

  return calculateOneBody(body, (sweBody) =>
    calculateSweBody(julianDay, sweBody),
  );
}

function calculateSweBody(julianDay: number, body: SweBody): BodyPosition {
  const position = _swe.calculatePosition(
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

/**
 * House cusps and angles for a Julian day (UT) and place. Longitude is
 * east-positive. Above the polar circles, Swiss Ephemeris falls back to
 * Porphyry for systems that can't be computed there (e.g. Placidus), and
 * `houseSystem` in the result says so.
 */
export function calculateHouses(
  julianDay: number,
  latitude: number,
  longitude: number,
  houseSystem: HouseSystem,
): HousePositions {
  _assertLoaded();

  const houses = _castHouses(julianDay, latitude, longitude, houseSystem);
  if (!SWE_POLAR_LIMITED_SYSTEMS.has(houseSystem)) {
    return houses;
  }

  // The WASM binding drops the engine's error code, so a fallback shows
  // only as cusps identical to the fallback system's.
  const fallback = _castHouses(
    julianDay,
    latitude,
    longitude,
    SWE_POLAR_FALLBACK_SYSTEM,
  );
  const isFallback = houses.cusps.every(
    (cusp, index) => cusp === fallback.cusps[index],
  );

  return isFallback ? fallback : houses;
}

function _castHouses(
  julianDay: number,
  latitude: number,
  longitude: number,
  houseSystem: HouseSystem,
): HousePositions {
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
    houseSystem,
  };
}

/** The WASM driver. Requires loadEphemeris() to have resolved. */
export const browserEphemeris: Ephemeris = {
  calculateBodies,
  calculateBody,
  calculateHouses,
};
