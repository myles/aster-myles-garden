import { CalculationFlag, Planet, SiderealMode } from "@swisseph/core";
import { calculatePosition, setSiderealMode } from "@swisseph/node";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

import { Ayanamsa } from "@/lib/astrology/ayanamsa";
import { Body } from "@/lib/astrology/bodies";
import { HouseSystem } from "@/lib/astrology/houses";
import {
  browserEphemeris,
  loadEphemeris,
  type Ephemeris,
} from "@/lib/engine/ephemeris";
import { SWE_CALCULATION_FLAGS } from "@/lib/engine/ephemeris-codes";
import { inZodiac } from "@/lib/engine/sidereal";
import { nodeEphemeris } from "@/lib/server/ephemeris";

const WASM_PATH = "node_modules/@swisseph/browser/dist/swisseph.wasm";
const WASM_DATA_URL =
  "data:application/wasm;base64," + readFileSync(WASM_PATH).toString("base64");

const J2000_JULIAN_DAY = 2_451_545;
const TORONTO = { latitude: 43.7064, longitude: -79.3986 };

/** Tropical positions at fixed longitudes, and an ayanamsa of 24°. */
const FAKE: Ephemeris = {
  calculateBodies: () => [
    { body: Body.Sun, longitude: 10, latitude: 0, speed: 1 },
    { body: Body.Moon, longitude: 200, latitude: 1, speed: 13 },
  ],
  calculateBody: (_, body) => ({
    body,
    longitude: 10,
    latitude: 0,
    speed: 1,
  }),
  calculateAyanamsa: () => 24,
  calculateHouses: (_julianDay, _latitude, _longitude, houseSystem) => ({
    cusps: Array.from({ length: 12 }, (_, i) => 5 + i * 30),
    ascendant: 5,
    midheaven: 275,
    houseSystem,
  }),
};

describe("inZodiac", () => {
  it("leaves the tropical zodiac alone", () => {
    expect(inZodiac(FAKE, undefined)).toBe(FAKE);
  });

  it("moves every body back by the ayanamsa, wrapping past 0°", () => {
    const sidereal = inZodiac(FAKE, Ayanamsa.Lahiri);

    expect(sidereal.calculateBodies(0).map((b) => b.longitude)).toEqual([
      346, 176,
    ]);
    expect(sidereal.calculateBody(0, Body.Sun).longitude).toBe(346);
  });

  it("keeps everything but the longitude", () => {
    const [, moon] = inZodiac(FAKE, Ayanamsa.Lahiri).calculateBodies(0);

    expect(moon).toEqual({
      body: Body.Moon,
      longitude: 176,
      latitude: 1,
      speed: 13,
    });
  });

  it("moves cusps and angles back by the ayanamsa", () => {
    const houses = inZodiac(FAKE, Ayanamsa.Lahiri).calculateHouses(
      0,
      0,
      0,
      HouseSystem.Placidus,
    );

    expect(houses.ascendant).toBe(341);
    expect(houses.midheaven).toBe(251);
    expect(houses.cusps[0]).toBe(341);
    expect(houses.cusps[1]).toBe(11);
  });

  it("starts whole sign houses on the sidereal sign of the ascendant", () => {
    const houses = inZodiac(FAKE, Ayanamsa.Lahiri).calculateHouses(
      0,
      0,
      0,
      HouseSystem.WholeSign,
    );

    // A sidereal ascendant at 341° is in Pisces, which starts at 330°.
    expect(houses.ascendant).toBe(341);
    expect(houses.cusps).toEqual(
      Array.from({ length: 12 }, (_, i) => (330 + i * 30) % 360),
    );
  });
});

describe("calculateAyanamsa", () => {
  beforeAll(() => loadEphemeris(WASM_DATA_URL));

  it.each([
    // Published values at J2000.0, to about an arcminute.
    [Ayanamsa.Lahiri, 23.86],
    [Ayanamsa.FaganBradley, 24.74],
    [Ayanamsa.Krishnamurti, 23.76],
  ])("gives %s's ayanamsa at J2000.0", (ayanamsa, expected) => {
    expect(
      browserEphemeris.calculateAyanamsa(J2000_JULIAN_DAY, ayanamsa),
    ).toBeCloseTo(expected, 1);
  });

  it.each(Object.values(Ayanamsa))(
    "agrees between the browser and server drivers for %s",
    (ayanamsa) => {
      expect(
        nodeEphemeris.calculateAyanamsa(J2000_JULIAN_DAY, ayanamsa),
      ).toBeCloseTo(
        browserEphemeris.calculateAyanamsa(J2000_JULIAN_DAY, ayanamsa),
        4,
      );
    },
  );

  it("grows as the equinox precesses", () => {
    const later = J2000_JULIAN_DAY + 72 * 365.25;

    expect(
      browserEphemeris.calculateAyanamsa(later, Ayanamsa.Lahiri) -
        browserEphemeris.calculateAyanamsa(J2000_JULIAN_DAY, Ayanamsa.Lahiri),
    ).toBeCloseTo(1, 1);
  });
});

describe("sidereal positions against the engine's own", () => {
  beforeAll(() => loadEphemeris(WASM_DATA_URL));

  it.each([
    [Planet.Sun, Body.Sun],
    [Planet.Moon, Body.Moon],
    [Planet.Pluto, Body.Pluto],
  ])("matches the engine's sidereal %s", (planet, body) => {
    setSiderealMode(SiderealMode.Lahiri);
    const engine = calculatePosition(
      J2000_JULIAN_DAY,
      planet,
      SWE_CALCULATION_FLAGS | CalculationFlag.Sidereal,
    );

    const ours = inZodiac(nodeEphemeris, Ayanamsa.Lahiri).calculateBody(
      J2000_JULIAN_DAY,
      body,
    );

    // Well under an arcsecond.
    expect(ours.longitude).toBeCloseTo(engine.longitude, 4);
  });

  it("casts houses in Toronto in the sidereal zodiac", () => {
    const tropical = nodeEphemeris.calculateHouses(
      J2000_JULIAN_DAY,
      TORONTO.latitude,
      TORONTO.longitude,
      HouseSystem.Placidus,
    );
    const sidereal = inZodiac(nodeEphemeris, Ayanamsa.Lahiri).calculateHouses(
      J2000_JULIAN_DAY,
      TORONTO.latitude,
      TORONTO.longitude,
      HouseSystem.Placidus,
    );
    const shift = nodeEphemeris.calculateAyanamsa(
      J2000_JULIAN_DAY,
      Ayanamsa.Lahiri,
    );

    expect((tropical.ascendant - sidereal.ascendant + 360) % 360).toBeCloseTo(
      shift,
      6,
    );
  });
});
