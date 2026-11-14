import type { Body } from "@/lib/bodies";
import type { HousePositions } from "@/lib/ephemeris";

import { normalizeDegrees } from "@/lib/zodiac";

/** The house (1–12) each body falls in. */
export type HouseOverlay = Partial<Record<Body, number>>;

export enum HouseSystem {
  Placidus = "placidus",
  Koch = "koch",
  WholeSign = "wholeSign",
  Equal = "equal",
  Porphyry = "porphyry",
  Regiomontanus = "regiomontanus",
  Campanus = "campanus",
}

export const DEFAULT_HOUSE_SYSTEM = HouseSystem.Placidus;

export const HOUSE_SYSTEM_NAMES: Record<HouseSystem, string> = {
  [HouseSystem.Placidus]: "Placidus",
  [HouseSystem.Koch]: "Koch",
  [HouseSystem.WholeSign]: "Whole Sign",
  [HouseSystem.Equal]: "Equal",
  [HouseSystem.Porphyry]: "Porphyry",
  [HouseSystem.Regiomontanus]: "Regiomontanus",
  [HouseSystem.Campanus]: "Campanus",
};

export const HOUSE_COUNT = 12;

/**
 * Why a chart's houses aren't the system asked for, naming whose chart.
 * Example: (Placidus, Porphyry, "these are") → "Placidus houses can't be
 * cast this close to the pole, so these are Porphyry houses."
 */
export function describeHouseFallback(
  requested: HouseSystem,
  used: HouseSystem,
  subject: string,
): string {
  return (
    `${HOUSE_SYSTEM_NAMES[requested]} houses can't be cast this close to ` +
    `the pole, so ${subject} ${HOUSE_SYSTEM_NAMES[used]} houses.`
  );
}

export function isHouseSystem(value: string): value is HouseSystem {
  return Object.values(HouseSystem).includes(value as HouseSystem);
}

/**
 * Finds which house (1–12) a longitude falls in, given the 12 cusps in
 * order. Each house runs from its cusp up to, not including, the next.
 */
export function findHouse(longitude: number, cusps: number[]): number {
  for (let i = 0; i < HOUSE_COUNT; i++) {
    const start = cusps[i];
    const end = cusps[(i + 1) % HOUSE_COUNT];
    const span = normalizeDegrees(end - start);
    const offset = normalizeDegrees(longitude - start);

    if (offset < span) {
      return i + 1;
    }
  }

  throw new Error(`Longitude ${longitude} is not inside any house`);
}

/**
 * Places bodies in a set of houses, such as one person's planets in
 * another's chart. Undefined when there are no houses to place them in.
 */
export function placeInHouses(
  bodies: { body: Body; longitude: number }[],
  houses: HousePositions | undefined,
): HouseOverlay | undefined {
  if (!houses) {
    return undefined;
  }

  return Object.fromEntries(
    bodies.map((placed) => [
      placed.body,
      findHouse(placed.longitude, houses.cusps),
    ]),
  );
}
