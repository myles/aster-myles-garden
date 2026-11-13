// Chart service: turns birth details into a complete natal chart. Sits
// between the UI and the ephemeris driver.

import { findAspects, type Aspect } from "@/lib/aspects";
import {
  calculateBodies,
  calculateHouses,
  loadEphemeris,
  type BodyPosition,
  type HousePositions,
} from "@/lib/ephemeris";
import { findHouse, type HouseSystem } from "@/lib/houses";
import type { Place } from "@/lib/places";
import { toJulianDay, toUtc, type LocalDateTime } from "@/lib/time";

export type BirthDetails = {
  local: LocalDateTime;
  place: Place;
  houseSystem: HouseSystem;
};

export type PlacedBody = BodyPosition & {
  house: number;
  isRetrograde: boolean;
};

export type Chart = {
  details: BirthDetails;
  bornAt: Date;
  julianDay: number;
  bodies: PlacedBody[];
  houses: HousePositions;
  aspects: Aspect[];
};

/** Fetches the calculation engine. Resolve before calling createChart. */
export function loadChartEngine(): Promise<void> {
  return loadEphemeris();
}

/** Builds a chart. Requires loadChartEngine() to have resolved. */
export function createChart(details: BirthDetails): Chart {
  const bornAt = toUtc(details.local, details.place.timeZone);
  const julianDay = toJulianDay(bornAt);

  const positions = calculateBodies(julianDay);
  const houses = calculateHouses(
    julianDay,
    details.place.latitude,
    details.place.longitude,
    details.houseSystem,
  );

  const bodies = positions.map((position) => ({
    ...position,
    house: findHouse(position.longitude, houses.cusps),
    isRetrograde: position.speed < 0,
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
