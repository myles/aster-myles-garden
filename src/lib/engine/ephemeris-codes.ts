// Swiss Ephemeris codes for Aster's bodies and house systems. Shared by
// the browser and server drivers, so both ask the engine the same thing.

import {
  CommonCalculationFlags,
  LunarPoint,
  Planet,
  SiderealMode,
  HouseSystem as SweHouseSystem,
} from "@swisseph/core";

import type { BodyPosition } from "@/lib/engine/ephemeris";

import { Ayanamsa } from "@/lib/astrology/ayanamsa";
import { Body, BODIES } from "@/lib/astrology/bodies";
import { HouseSystem } from "@/lib/astrology/houses";
import { normalizeDegrees } from "@/lib/astrology/zodiac";

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

/** Bodies the engine is asked for; the rest are derived from them. */
export type SweBody = Exclude<Body, Body.SouthNode>;

export const SWE_BODIES: Record<SweBody, Planet | LunarPoint> = {
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
  // Black Moon Lilith, as most software draws it: the mean apogee.
  [Body.Lilith]: LunarPoint.MeanApogee,
};

/**
 * One body's position, from a driver's way of asking the engine for one.
 * The South Node is found from the North Node, as calculateEveryBody does.
 */
export function calculateOneBody(
  body: Body,
  calculateBody: (body: SweBody) => BodyPosition,
): BodyPosition {
  if (body !== Body.SouthNode) {
    return calculateBody(body);
  }

  return toSouthNode(calculateBody(Body.NorthNode));
}

/**
 * Every body's position, in Body order, from a driver's way of asking
 * the engine for one. The South Node isn't asked for: it's always
 * exactly opposite the North Node, moving with it.
 */
export function calculateEveryBody(
  calculateBody: (body: SweBody) => BodyPosition,
): BodyPosition[] {
  const northNode = calculateBody(Body.NorthNode);

  return BODIES.map((body) => {
    if (body === Body.NorthNode) {
      return northNode;
    }

    if (body === Body.SouthNode) {
      return toSouthNode(northNode);
    }

    return calculateBody(body);
  });
}

function toSouthNode(northNode: BodyPosition): BodyPosition {
  return {
    body: Body.SouthNode,
    longitude: normalizeDegrees(northNode.longitude + 180),
    latitude: -northNode.latitude,
    speed: northNode.speed,
  };
}

export const SWE_SIDEREAL_MODES: Record<Ayanamsa, SiderealMode> = {
  [Ayanamsa.Lahiri]: SiderealMode.Lahiri,
  [Ayanamsa.FaganBradley]: SiderealMode.FaganBradley,
  [Ayanamsa.Krishnamurti]: SiderealMode.Krishnamurti,
  [Ayanamsa.Raman]: SiderealMode.Raman,
  [Ayanamsa.Yukteshwar]: SiderealMode.Yukteshwar,
  [Ayanamsa.TrueChitra]: SiderealMode.TrueCitra,
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
