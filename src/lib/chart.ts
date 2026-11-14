// Chart service: turns birth details into a complete natal chart. Sits
// between the UI and the ephemeris driver.

import type { Body } from "@/lib/bodies";
import type { Place } from "@/lib/places";

import { findAspects, type Aspect } from "@/lib/aspects";
import {
  browserEphemeris,
  loadEphemeris,
  type BodyPosition,
  type Ephemeris,
  type HousePositions,
} from "@/lib/ephemeris";
import { SWE_MAX_JULIAN_DAY, SWE_MIN_JULIAN_DAY } from "@/lib/ephemeris-codes";
import { findHouse, type HouseSystem } from "@/lib/houses";
import { toJulianDay, toUtc, type LocalDate, type LocalTime } from "@/lib/time";
import { getSign, type Sign } from "@/lib/zodiac";

export type BirthDetails = {
  date: LocalDate;
  /** Undefined when the birth time isn't known. */
  time?: LocalTime;
  place: Place;
  houseSystem: HouseSystem;
};

export type PlacedBody = BodyPosition & {
  /** Undefined when the birth time, and so the houses, aren't known. */
  house?: number;
  isRetrograde: boolean;
  /**
   * Only when the birth time isn't known: every sign the body is in at
   * some point on the birth date. Two signs means it crossed that day.
   */
  possibleSigns?: Sign[];
};

export type Chart = {
  details: BirthDetails;
  bornAt: Date;
  julianDay: number;
  bodies: PlacedBody[];
  /** Undefined when the birth time isn't known. */
  houses?: HousePositions;
  aspects: Aspect[];
};

/**
 * Whether the houses were cast with a system other than the one asked
 * for: inside the polar circles, Placidus and Koch fall back to Porphyry.
 */
export function usesFallbackHouses(chart: Chart): boolean {
  return (
    chart.houses !== undefined &&
    chart.houses.houseSystem !== chart.details.houseSystem
  );
}

/** Without a birth time, the chart is cast for the middle of the day. */
const UNKNOWN_TIME_STANDIN: LocalTime = { hour: 12, minute: 0 };
const DAY_START: LocalTime = { hour: 0, minute: 0 };
const DAY_END: LocalTime = { hour: 23, minute: 59 };

/**
 * The last date a date field offers. The engine runs out on 29 April 3003
 * (UT), so the year 3003 is left out rather than cut short.
 */
export const LAST_CALCULABLE_DATE_VALUE = "3002-12-31";

/** Whether the engine covers a moment: about 3000 BCE to 3000 CE. */
export function canCalculateMoment(at: Date): boolean {
  const julianDay = toJulianDay(at);
  return julianDay >= SWE_MIN_JULIAN_DAY && julianDay <= SWE_MAX_JULIAN_DAY;
}

/**
 * Whether the engine covers the whole of a local date. The whole day is
 * checked, since a chart without a birth time reads both of its ends.
 */
export function canCalculateDate(date: LocalDate, timeZone: string): boolean {
  return [DAY_START, DAY_END].every((time) =>
    canCalculateMoment(toUtc({ ...date, ...time }, timeZone)),
  );
}

/** Fetches the calculation engine. Resolve before calling createChart. */
export function loadChartEngine(): Promise<void> {
  return loadEphemeris();
}

/**
 * Builds a chart. In the browser, requires loadChartEngine() to have
 * resolved; the server passes its own ephemeris driver.
 */
export function createChart(
  details: BirthDetails,
  ephemeris: Ephemeris = browserEphemeris,
): Chart {
  const time = details.time ?? UNKNOWN_TIME_STANDIN;
  const bornAt = toUtc({ ...details.date, ...time }, details.place.timeZone);
  const julianDay = toJulianDay(bornAt);

  const positions = ephemeris.calculateBodies(julianDay);
  const houses = details.time
    ? ephemeris.calculateHouses(
        julianDay,
        details.place.latitude,
        details.place.longitude,
        details.houseSystem,
      )
    : undefined;
  const possibleSigns = details.time
    ? undefined
    : findPossibleSigns(details, ephemeris);

  const bodies = positions.map((position) => ({
    ...position,
    house: houses && findHouse(position.longitude, houses.cusps),
    isRetrograde: position.speed < 0,
    possibleSigns: possibleSigns?.get(position.body),
  }));

  return {
    details,
    bornAt,
    julianDay,
    bodies,
    houses,
    aspects: findAspects(positions),
  };
}

/**
 * Finds the signs each body passes through on the birth date, by
 * comparing its positions at the start and end of that local day. No
 * body moves fast enough to cross two sign boundaries in a day.
 */
function findPossibleSigns(
  details: BirthDetails,
  ephemeris: Ephemeris,
): Map<Body, Sign[]> {
  const calculateAt = (time: LocalTime) =>
    ephemeris.calculateBodies(
      toJulianDay(toUtc({ ...details.date, ...time }, details.place.timeZone)),
    );
  const atStart = calculateAt(DAY_START);
  const atEnd = calculateAt(DAY_END);

  return new Map(
    atStart.map((start, index) => {
      // getSign returns shared Sign objects, so a Set drops a repeat.
      const signs = new Set([
        getSign(start.longitude),
        getSign(atEnd[index].longitude),
      ]);
      return [start.body, [...signs]];
    }),
  );
}
