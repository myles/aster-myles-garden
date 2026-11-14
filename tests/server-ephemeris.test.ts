import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

import { Body } from "@/lib/bodies";
import { browserEphemeris, loadEphemeris } from "@/lib/ephemeris";
import { HouseSystem } from "@/lib/houses";
import { nodeEphemeris } from "@/lib/server/ephemeris";

const J2000_JULIAN_DAY = 2_451_545;
// 1990-05-15 18:30 UT, an arbitrary moment away from J2000.
const LATER_JULIAN_DAY = 2_448_027.270_833;
const TORONTO = { latitude: 43.7064, longitude: -79.3986 };
// Tromsø, inside the Arctic Circle, where Placidus and Koch can't be cast.
const TROMSO = { latitude: 69.65, longitude: 18.96 };

// The native and WASM builds differ by float rounding: up to about 1e-5°
// in position (0.03″) and 6e-5° a day in speed, over 1850–2130. Far below
// the minute of arc a chart shows.
const PARITY_DECIMALS = 4;
const SPEED_PARITY_DECIMALS = 3;

const WASM_PATH = "node_modules/@swisseph/browser/dist/swisseph.wasm";
const WASM_DATA_URL =
  "data:application/wasm;base64," + readFileSync(WASM_PATH).toString("base64");

beforeAll(() => loadEphemeris(WASM_DATA_URL));

describe("nodeEphemeris.calculateBodies", () => {
  it("returns every body", () => {
    const bodies = nodeEphemeris
      .calculateBodies(J2000_JULIAN_DAY)
      .map((position) => position.body);

    expect(bodies).toEqual(Object.values(Body));
  });

  it("places the Sun at J2000.0", () => {
    const sun = nodeEphemeris
      .calculateBodies(J2000_JULIAN_DAY)
      .find((position) => position.body === Body.Sun);

    expect(sun?.longitude).toBeCloseTo(280.369, 2);
    expect(sun?.speed).toBeGreaterThan(0);
  });

  it("matches the browser driver", () => {
    for (const julianDay of [J2000_JULIAN_DAY, LATER_JULIAN_DAY]) {
      const fromNode = nodeEphemeris.calculateBodies(julianDay);
      const fromBrowser = browserEphemeris.calculateBodies(julianDay);

      fromNode.forEach((position, index) => {
        const expected = fromBrowser[index];
        expect(position.body).toBe(expected.body);
        expect(position.longitude).toBeCloseTo(
          expected.longitude,
          PARITY_DECIMALS,
        );
        expect(position.latitude).toBeCloseTo(
          expected.latitude,
          PARITY_DECIMALS,
        );
        expect(position.speed).toBeCloseTo(
          expected.speed,
          SPEED_PARITY_DECIMALS,
        );
      });
    }
  });
});

describe("nodeEphemeris.calculateHouses", () => {
  it("matches the browser driver for every house system", () => {
    for (const houseSystem of Object.values(HouseSystem)) {
      const args = [
        LATER_JULIAN_DAY,
        TORONTO.latitude,
        TORONTO.longitude,
        houseSystem,
      ] as const;
      const fromNode = nodeEphemeris.calculateHouses(...args);
      const fromBrowser = browserEphemeris.calculateHouses(...args);

      expect(fromNode.cusps).toHaveLength(12);
      fromNode.cusps.forEach((cusp, index) => {
        expect(cusp).toBeCloseTo(fromBrowser.cusps[index], PARITY_DECIMALS);
      });
      expect(fromNode.ascendant).toBeCloseTo(
        fromBrowser.ascendant,
        PARITY_DECIMALS,
      );
      expect(fromNode.midheaven).toBeCloseTo(
        fromBrowser.midheaven,
        PARITY_DECIMALS,
      );
    }
  });
});

describe("polar house systems", () => {
  const drivers = [
    ["nodeEphemeris", nodeEphemeris],
    ["browserEphemeris", browserEphemeris],
  ] as const;

  const castAtTromso = (
    ephemeris: (typeof drivers)[number][1],
    houseSystem: HouseSystem,
  ) =>
    ephemeris.calculateHouses(
      J2000_JULIAN_DAY,
      TROMSO.latitude,
      TROMSO.longitude,
      houseSystem,
    );

  it.each(drivers)(
    "%s falls back to Porphyry for Placidus and Koch",
    (_name, ephemeris) => {
      const porphyry = castAtTromso(ephemeris, HouseSystem.Porphyry);

      for (const houseSystem of [HouseSystem.Placidus, HouseSystem.Koch]) {
        const houses = castAtTromso(ephemeris, houseSystem);

        expect(houses.houseSystem).toBe(HouseSystem.Porphyry);
        expect(houses.cusps).toEqual(porphyry.cusps);
      }
    },
  );

  it.each(drivers)("%s keeps systems that work there", (_name, ephemeris) => {
    for (const houseSystem of [
      HouseSystem.Regiomontanus,
      HouseSystem.WholeSign,
    ]) {
      expect(castAtTromso(ephemeris, houseSystem).houseSystem).toBe(
        houseSystem,
      );
    }
  });

  it.each(drivers)(
    "%s reports the requested system away from the poles",
    (_name, ephemeris) => {
      const houses = ephemeris.calculateHouses(
        LATER_JULIAN_DAY,
        TORONTO.latitude,
        TORONTO.longitude,
        HouseSystem.Placidus,
      );

      expect(houses.houseSystem).toBe(HouseSystem.Placidus);
    },
  );
});
