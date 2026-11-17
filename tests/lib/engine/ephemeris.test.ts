import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

import { Body } from "@/lib/astrology/bodies";
import { HouseSystem } from "@/lib/astrology/houses";
import {
  calculateBodies,
  calculateBody,
  calculateHouses,
  loadEphemeris,
} from "@/lib/engine/ephemeris";

const J2000_JULIAN_DAY = 2_451_545;
const LONDON = { latitude: 51.5085, longitude: -0.1257 };

// Node's fetch can't read file: URLs, so hand the module a data URL.
const WASM_PATH = "node_modules/@swisseph/browser/dist/swisseph.wasm";
const WASM_DATA_URL =
  "data:application/wasm;base64," + readFileSync(WASM_PATH).toString("base64");

beforeAll(() => loadEphemeris(WASM_DATA_URL));

describe("calculateBodies", () => {
  it("returns every body", () => {
    const bodies = calculateBodies(J2000_JULIAN_DAY).map((b) => b.body);
    expect(bodies).toEqual(Object.values(Body));
  });

  it("places the Sun at J2000.0", () => {
    const sun = calculateBodies(J2000_JULIAN_DAY).find(
      (position) => position.body === Body.Sun,
    );
    // Apparent geocentric longitude, 2000-01-01 12:00 UT.
    expect(sun?.longitude).toBeCloseTo(280.369, 2);
    expect(sun?.speed).toBeGreaterThan(0);
  });

  it("places the South Node opposite the North Node", () => {
    const positions = calculateBodies(J2000_JULIAN_DAY);
    const north = positions.find((p) => p.body === Body.NorthNode);
    const south = positions.find((p) => p.body === Body.SouthNode);

    expect(north).toBeDefined();
    expect(south?.longitude).toBeCloseTo((north!.longitude + 180) % 360, 6);
    expect(south?.latitude).toBeCloseTo(-north!.latitude, 6);
    expect(south?.speed).toBe(north!.speed);
  });

  it("places Lilith at the mean lunar apogee", () => {
    const lilith = calculateBodies(J2000_JULIAN_DAY).find(
      (position) => position.body === Body.Lilith,
    );
    // The mean lunar perigee at J2000.0 is 83.353° (Meeus); the apogee is
    // opposite. The engine's corrections move it about 0.1°, while the
    // osculating apogee would be off by degrees.
    expect(lilith?.longitude).toBeCloseTo(263.35, 0);
  });
});

describe("calculateBody", () => {
  it.each(Object.values(Body))("matches calculateBodies for %s", (body) => {
    const all = calculateBodies(J2000_JULIAN_DAY);

    expect(calculateBody(J2000_JULIAN_DAY, body)).toEqual(
      all.find((position) => position.body === body),
    );
  });
});

describe("calculateHouses", () => {
  it("returns 12 cusps with the first on the ascendant", () => {
    const houses = calculateHouses(
      J2000_JULIAN_DAY,
      LONDON.latitude,
      LONDON.longitude,
      HouseSystem.Placidus,
    );

    expect(houses.cusps).toHaveLength(12);
    expect(houses.cusps[0]).toBeCloseTo(houses.ascendant, 6);
    expect(houses.cusps[9]).toBeCloseTo(houses.midheaven, 6);
  });

  it("starts whole sign houses on sign boundaries", () => {
    const houses = calculateHouses(
      J2000_JULIAN_DAY,
      LONDON.latitude,
      LONDON.longitude,
      HouseSystem.WholeSign,
    );

    for (const cusp of houses.cusps) {
      expect(cusp % 30).toBeCloseTo(0, 6);
    }
  });
});
