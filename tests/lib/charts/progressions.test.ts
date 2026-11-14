import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

import { AspectType } from "@/lib/astrology/aspects";
import { Body } from "@/lib/astrology/bodies";
import { HouseSystem } from "@/lib/astrology/houses";
import { createChart, type Chart, type PlacedBody } from "@/lib/charts/chart";
import {
  createProgressions,
  PROGRESSION_MAX_ORB_DEGREES,
} from "@/lib/charts/progressions";
import { loadEphemeris } from "@/lib/engine/ephemeris";

const WASM_PATH = "node_modules/@swisseph/browser/dist/swisseph.wasm";
const WASM_DATA_URL =
  "data:application/wasm;base64," + readFileSync(WASM_PATH).toString("base64");

const TORONTO = {
  id: 6167865,
  name: "Toronto",
  region: "Ontario",
  country: "Canada",
  latitude: 43.7064,
  longitude: -79.3986,
  timeZone: "America/Toronto",
};

const MS_PER_DAY = 86_400_000;

function findSun(chart: { bodies: PlacedBody[] }): PlacedBody | undefined {
  return chart.bodies.find((placed) => placed.body === Body.Sun);
}

describe("createProgressions", () => {
  let natal: Chart;

  beforeAll(async () => {
    await loadEphemeris(WASM_DATA_URL);
    natal = createChart({
      date: { year: 2000, month: 1, day: 1 },
      time: { hour: 7, minute: 0 },
      place: TORONTO,
      houseSystem: HouseSystem.Placidus,
    });
  });

  it("moves the chart on a day for each year of life", () => {
    // 1 January 2030 at noon UT is just over 30 years after birth.
    const progressions = createProgressions(natal, {
      year: 2030,
      month: 1,
      day: 1,
    });
    const daysOn =
      (progressions.skyAt.getTime() - natal.bornAt.getTime()) / MS_PER_DAY;

    expect(progressions.natal).toBe(natal);
    expect(progressions.forDate).toEqual({ year: 2030, month: 1, day: 1 });
    expect(daysOn).toBeCloseTo(30.0, 1);
  });

  it("moves the Sun about a degree a year", () => {
    const progressions = createProgressions(natal, {
      year: 2030,
      month: 1,
      day: 1,
    });
    const natalSun = findSun(natal);

    // The Sun moves a little over a degree a day in January.
    const movedDegrees = findSun(progressions)!.longitude - natalSun!.longitude;
    expect(movedDegrees).toBeGreaterThan(30);
    expect(movedDegrees).toBeLessThan(31);
  });

  it("matches the natal chart on the day of birth", () => {
    const progressions = createProgressions(natal, natal.details.date);
    const natalSun = findSun(natal);

    expect(findSun(progressions)!.longitude).toBeCloseTo(
      natalSun!.longitude,
      2,
    );
    expect(progressions.aspects).toContainEqual(
      expect.objectContaining({
        first: Body.Sun,
        second: Body.Sun,
        type: AspectType.Conjunction,
      }),
    );
  });

  it("only counts aspects within the progression orb", () => {
    const progressions = createProgressions(natal, {
      year: 2030,
      month: 1,
      day: 1,
    });

    for (const aspect of progressions.aspects) {
      expect(aspect.orbDegrees).toBeLessThanOrEqual(
        PROGRESSION_MAX_ORB_DEGREES,
      );
    }
  });

  it("places the progressed planets in the natal houses", () => {
    const progressions = createProgressions(natal, {
      year: 2030,
      month: 1,
      day: 1,
    });

    expect(progressions.inNatalHouses?.[Body.Sun]).toBeGreaterThan(0);
    for (const placed of progressions.bodies) {
      expect(placed.house).toBeUndefined();
      expect(placed.isRetrograde).toBe(placed.speed < 0);
    }
  });

  it("has no natal houses to place them in without a birth time", () => {
    const untimed = createChart({ ...natal.details, time: undefined });
    const progressions = createProgressions(untimed, {
      year: 2030,
      month: 1,
      day: 1,
    });

    expect(progressions.inNatalHouses).toBeUndefined();
  });

  it("refuses a date before the birth", () => {
    expect(() =>
      createProgressions(natal, { year: 1999, month: 12, day: 31 }),
    ).toThrow("Choose a date from the birth onwards.");
  });
});
