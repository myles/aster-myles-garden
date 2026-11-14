import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

import { AspectSet, DEFAULT_ASPECT_SETTINGS } from "@/lib/aspects";
import { Body } from "@/lib/bodies";
import { createChart, type BirthDetails, type Chart } from "@/lib/chart";
import {
  browserEphemeris,
  calculateBodies,
  loadEphemeris,
} from "@/lib/ephemeris";
import { HouseSystem } from "@/lib/houses";
import {
  createSolarReturn,
  findCurrentReturnYear,
  findSolarReturn,
} from "@/lib/solar-return";
import { toJulianDay } from "@/lib/time";
import { separateDegrees } from "@/lib/zodiac";

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

const LONDON = {
  id: 2643743,
  name: "London",
  region: "England",
  country: "United Kingdom",
  latitude: 51.5085,
  longitude: -0.1257,
  timeZone: "Europe/London",
};

const BIRTH: BirthDetails = {
  date: { year: 2000, month: 1, day: 1 },
  time: { hour: 7, minute: 0 },
  place: TORONTO,
  houseSystem: HouseSystem.Koch,
  aspectSettings: { ...DEFAULT_ASPECT_SETTINGS, aspectSet: AspectSet.All },
};

const MS_PER_DAY = 86_400_000;

function sunAt(at: Date): number {
  return calculateBodies(toJulianDay(at)).find(
    (position) => position.body === Body.Sun,
  )!.longitude;
}

function sunOf(chart: Chart): number {
  return chart.bodies.find((placed) => placed.body === Body.Sun)!.longitude;
}

describe("findSolarReturn", () => {
  let natal: Chart;

  beforeAll(async () => {
    await loadEphemeris(WASM_DATA_URL);
    natal = createChart(BIRTH);
  });

  it("finds the moment the Sun is back where it was at birth", () => {
    const at = findSolarReturn(natal, 2026);

    // A millionth of a degree is about a tenth of a second of the Sun.
    expect(separateDegrees(sunAt(at), sunOf(natal))).toBeLessThan(1e-6);
  });

  it("settles in a few steps", () => {
    let steps = 0;
    const counting = {
      ...browserEphemeris,
      calculateBodies: (julianDay: number) => {
        steps++;
        return browserEphemeris.calculateBodies(julianDay);
      },
    };

    for (const year of [2001, 2026, 2100]) {
      steps = 0;
      findSolarReturn(natal, year, counting);
      expect(steps, `for ${year}`).toBeLessThanOrEqual(4);
    }
  });

  it("finds it near the birthday of the year asked for", () => {
    const at = findSolarReturn(natal, 2026);
    const birthday = new Date("2026-01-01T12:00:00Z");

    expect(Math.abs(at.getTime() - birthday.getTime())).toBeLessThan(
      MS_PER_DAY,
    );
  });

  it("needs the birth time", () => {
    const timeless = createChart({ ...BIRTH, time: undefined });

    expect(() => findSolarReturn(timeless, 2026)).toThrow("birth time");
  });

  it("needs a year after the birth year", () => {
    expect(() => findSolarReturn(natal, 2000)).toThrow("after 2000");
  });

  it("refuses years the engine can't calculate", () => {
    expect(() => findSolarReturn(natal, 3500)).toThrow("3000");
  });
});

describe("createSolarReturn", () => {
  let natal: Chart;

  beforeAll(async () => {
    await loadEphemeris(WASM_DATA_URL);
    natal = createChart(BIRTH);
  });

  it("casts a chart for the moment, where you are that year", () => {
    const solarReturn = createSolarReturn(natal, 2026, LONDON);
    const { chart } = solarReturn;

    expect(solarReturn.natal).toBe(natal);
    expect(solarReturn.year).toBe(2026);
    expect(chart.bornAt).toEqual(findSolarReturn(natal, 2026));
    expect(chart.details.place).toBe(LONDON);
    expect(chart.houses).toBeDefined();
    expect(separateDegrees(sunOf(chart), sunOf(natal))).toBeLessThan(1e-6);
  });

  it("keeps the natal chart's house system and aspect settings", () => {
    const { chart } = createSolarReturn(natal, 2026, LONDON);

    expect(chart.details.houseSystem).toBe(HouseSystem.Koch);
    expect(chart.details.aspectSettings).toBe(BIRTH.aspectSettings);
  });

  it("gives the moment on the place's own clock", () => {
    const { chart } = createSolarReturn(natal, 2026, LONDON);

    // London keeps GMT around the new year, so its clock reads UTC.
    expect(chart.details.date).toEqual({
      year: chart.bornAt.getUTCFullYear(),
      month: chart.bornAt.getUTCMonth() + 1,
      day: chart.bornAt.getUTCDate(),
    });
    expect(chart.details.time).toEqual({
      hour: chart.bornAt.getUTCHours(),
      minute: chart.bornAt.getUTCMinutes(),
    });
  });
});

describe("findCurrentReturnYear", () => {
  let natal: Chart;

  beforeAll(async () => {
    await loadEphemeris(WASM_DATA_URL);
    natal = createChart(BIRTH);
  });

  const MS_PER_MINUTE = 60_000;
  const around = (at: Date, minutes: number) =>
    new Date(at.getTime() + minutes * MS_PER_MINUTE);

  it("is this year's once the Sun has got back", () => {
    expect(findCurrentReturnYear(natal, new Date("2026-11-13T20:00Z"))).toBe(
      2026,
    );
  });

  it("is last year's until the Sun gets back", () => {
    const returnAt = findSolarReturn(natal, 2027);

    expect(findCurrentReturnYear(natal, around(returnAt, -1))).toBe(2026);
    expect(findCurrentReturnYear(natal, around(returnAt, 1))).toBe(2027);
  });

  it("is next year's when its return comes before New Year", () => {
    // Born on 1 January, so some returns fall on 31 December.
    const returnAt = findSolarReturn(natal, 2026);
    expect(returnAt.getUTCFullYear()).toBe(2025);

    expect(findCurrentReturnYear(natal, around(returnAt, 1))).toBe(2026);
  });

  it("is the first one ahead, in the year of birth", () => {
    expect(findCurrentReturnYear(natal, new Date("2000-06-01T00:00Z"))).toBe(
      2001,
    );
  });
});
