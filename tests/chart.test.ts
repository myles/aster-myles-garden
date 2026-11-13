import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

import { Body } from "@/lib/bodies";
import { createChart, type Chart } from "@/lib/chart";
import { loadEphemeris } from "@/lib/ephemeris";
import { HOUSE_COUNT, HouseSystem } from "@/lib/houses";

const WASM_PATH = "node_modules/@swisseph/browser/dist/swisseph.wasm";
const WASM_DATA_URL =
  "data:application/wasm;base64," + readFileSync(WASM_PATH).toString("base64");

const TORONTO = {
  name: "Toronto",
  region: "Ontario",
  country: "Canada",
  latitude: 43.7064,
  longitude: -79.3986,
  timeZone: "America/Toronto",
};

describe("createChart", () => {
  let chart: Chart;

  beforeAll(async () => {
    await loadEphemeris(WASM_DATA_URL);
    chart = createChart({
      local: { year: 2000, month: 1, day: 1, hour: 7, minute: 0 },
      place: TORONTO,
      houseSystem: HouseSystem.Placidus,
    });
  });

  it("converts local birth time to UT", () => {
    expect(chart.bornAt.toISOString()).toBe("2000-01-01T12:00:00.000Z");
    expect(chart.julianDay).toBe(2_451_545);
  });

  it("places every body in a house", () => {
    for (const body of chart.bodies) {
      expect(body.house).toBeGreaterThanOrEqual(1);
      expect(body.house).toBeLessThanOrEqual(HOUSE_COUNT);
    }
  });

  it("puts the Sun just below the horizon before sunrise", () => {
    // Sunrise in Toronto on 1 January is about 07:51, so at 07:00 the Sun
    // is just below the eastern horizon — the end of the 1st house.
    const sun = chart.bodies.find((body) => body.body === Body.Sun);
    expect(sun?.house).toBe(1);
  });

  it("flags retrograde bodies from their speed", () => {
    for (const body of chart.bodies) {
      expect(body.isRetrograde).toBe(body.speed < 0);
    }
  });
});
