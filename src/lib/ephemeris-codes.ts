// Swiss Ephemeris codes for Aster's bodies and house systems. Shared by
// the browser and server drivers, so both ask the engine the same thing.

import {
  CommonCalculationFlags,
  LunarPoint,
  Planet,
  HouseSystem as SweHouseSystem,
} from "@swisseph/core";

import { Body } from "@/lib/bodies";
import { HouseSystem } from "@/lib/houses";

/**
 * The Moshier ephemeris, with speeds. It needs no data files, so the
 * browser can run it; the server uses it too, so a chart from the API
 * matches the one its share link draws.
 */
export const SWE_CALCULATION_FLAGS = CommonCalculationFlags.DefaultMoshier;

/**
 * The span the Moshier ephemeris covers, as Julian days (UT): roughly
 * 3000 BCE to 3000 CE. The engine throws outside it.
 */
export const SWE_MIN_JULIAN_DAY = 625_000.5;
export const SWE_MAX_JULIAN_DAY = 2_818_000.5;

/**
 * Systems Swiss Ephemeris can't cast inside the polar circles. There it
 * casts the fallback system instead, and returns an error code.
 */
export const SWE_POLAR_LIMITED_SYSTEMS: ReadonlySet<HouseSystem> = new Set([
  HouseSystem.Placidus,
  HouseSystem.Koch,
]);
export const SWE_POLAR_FALLBACK_SYSTEM = HouseSystem.Porphyry;

export const SWE_BODIES: Record<Body, Planet | LunarPoint> = {
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

export const SWE_HOUSE_SYSTEMS: Record<HouseSystem, SweHouseSystem> = {
  [HouseSystem.Placidus]: SweHouseSystem.Placidus,
  [HouseSystem.Koch]: SweHouseSystem.Koch,
  [HouseSystem.WholeSign]: SweHouseSystem.WholeSign,
  [HouseSystem.Equal]: SweHouseSystem.Equal,
  [HouseSystem.Porphyry]: SweHouseSystem.Porphyrius,
  [HouseSystem.Regiomontanus]: SweHouseSystem.Regiomontanus,
  [HouseSystem.Campanus]: SweHouseSystem.Campanus,
};
