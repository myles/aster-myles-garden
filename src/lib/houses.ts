import { normalizeDegrees } from "@/lib/zodiac";

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
