import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

import { AspectSet, DEFAULT_ASPECT_SETTINGS } from "@/lib/astrology/aspects";
import { Body } from "@/lib/astrology/bodies";
import { HouseSystem } from "@/lib/astrology/houses";
import { separateDegrees } from "@/lib/astrology/zodiac";
import { createChart, type BirthDetails, type Chart } from "@/lib/charts/chart";
import { createLunarReturn, findLunarReturn } from "@/lib/charts/lunar-return";
import {
  browserEphemeris,
  calculateBodies,
  loadEphemeris,
} from "@/lib/engine/ephemeris";
import { toJulianDay, toLocal } from "@/lib/time";

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

const TOKYO = {
  id: 1850147,
  name: "Tokyo",
  region: "Tokyo",
  country: "Japan",
  latitude: 35.6895,
  longitude: 139.6917,
  timeZone: "Asia/Tokyo",
};

const BIRTH: BirthDetails = {
  date: { year: 2000, month: 1, day: 1 },
  time: { hour: 7, minute: 0 },
  place: TORONTO,
  houseSystem: HouseSystem.Koch,
  aspectSettings: { ...DEFAULT_ASPECT_SETTINGS, aspectSet: AspectSet.All },
};

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
/** The longest a lunar month runs: the Moon's speed varies. */
const LONGEST_MONTH_MS = 28 * MS_PER_DAY;

function moonAt(at: Date): number {
  return calculateBodies(toJulianDay(at)).find(
    (position) => position.body === Body.Moon,
  )!.longitude;
}

function moonOf(chart: Chart): number {
  return chart.bodies.find((placed) => placed.body === Body.Moon)!.longitude;
}

const around = (at: Date, minutes: number) =>
  new Date(at.getTime() + minutes * MS_PER_MINUTE);

/** Searches from different starts settle a few milliseconds apart. */
const isSameMoment = (a: Date, b: Date) =>
  Math.abs(a.getTime() - b.getTime()) < 1000;

describe("findLunarReturn", () => {
  let natal: Chart;

  beforeAll(async () => {
    await loadEphemeris(WASM_DATA_URL);
    natal = createChart(BIRTH);
  });

  it("finds a moment the Moon is back where it was at birth", () => {
    const at = findLunarReturn(natal, new Date("2026-11-17T12:00Z"));

    // A millionth of a degree is about a tenth of a second of the Moon.
    expect(separateDegrees(moonAt(at), moonOf(natal))).toBeLessThan(1e-5);
  });

  it("finds the latest one before the moment asked for", () => {
    const by = new Date("2026-11-17T12:00Z");
    const at = findLunarReturn(natal, by);

    expect(at.getTime()).toBeLessThan(by.getTime());
    expect(by.getTime() - at.getTime()).toBeLessThan(LONGEST_MONTH_MS);
  });

  it("switches to the next return the moment it comes", () => {
    const returnAt = findLunarReturn(natal, new Date("2026-11-17T12:00Z"));
    const previous = findLunarReturn(natal, around(returnAt, -1));

    expect(
      isSameMoment(findLunarReturn(natal, around(returnAt, 1)), returnAt),
    ).toBe(true);
    expect(previous.getTime()).toBeLessThan(returnAt.getTime());
    expect(returnAt.getTime() - previous.getTime()).toBeLessThan(
      LONGEST_MONTH_MS,
    );
  });

  it("finds every return across a year, a month apart", () => {
    let by = new Date("2027-01-01T00:00Z");
    const found: Date[] = [];
    while (found.length < 14) {
      const at = findLunarReturn(natal, by);
      found.push(at);
      by = around(at, -1);
    }

    for (let i = 1; i < found.length; i++) {
      const gapDays =
        (found[i - 1].getTime() - found[i].getTime()) / MS_PER_DAY;
      expect(gapDays, `gap ${i}`).toBeGreaterThan(26.5);
      expect(gapDays, `gap ${i}`).toBeLessThan(28.5);
    }
  });

  it("settles in a handful of steps", () => {
    let steps = 0;
    const counting = {
      ...browserEphemeris,
      calculateBodies: (julianDay: number) => {
        steps++;
        return browserEphemeris.calculateBodies(julianDay);
      },
    };

    for (const by of ["2000-03-01", "2026-11-17", "2100-06-15"]) {
      steps = 0;
      findLunarReturn(natal, new Date(`${by}T00:00Z`), counting);
      expect(steps, `by ${by}`).toBeLessThanOrEqual(16);
    }
  });

  it("needs the birth time", () => {
    const timeless = createChart({ ...BIRTH, time: undefined });

    expect(() =>
      findLunarReturn(timeless, new Date("2026-11-17T12:00Z")),
    ).toThrow("birth time");
  });

  it("refuses a moment before the first return", () => {
    expect(() => findLunarReturn(natal, new Date("2000-01-20T00:00Z"))).toThrow(
      "four weeks after birth",
    );
  });

  it("finds the first return, about four weeks after birth", () => {
    const at = findLunarReturn(natal, new Date("2000-02-10T00:00Z"));
    const days = (at.getTime() - natal.bornAt.getTime()) / MS_PER_DAY;

    expect(days).toBeGreaterThan(26.5);
    expect(days).toBeLessThan(28.5);
  });

  it("refuses moments the engine can't calculate", () => {
    expect(() => findLunarReturn(natal, new Date("3500-01-01T00:00Z"))).toThrow(
      "3000",
    );
  });
});

describe("createLunarReturn", () => {
  let natal: Chart;

  beforeAll(async () => {
    await loadEphemeris(WASM_DATA_URL);
    natal = createChart(BIRTH);
  });

  it("casts a chart for the moment, where you are", () => {
    const lunarReturn = createLunarReturn(
      natal,
      { year: 2026, month: 11, day: 17 },
      TOKYO,
    );
    const { chart } = lunarReturn;

    expect(lunarReturn.natal).toBe(natal);
    expect(chart.details.place).toBe(TOKYO);
    expect(chart.houses).toBeDefined();
    expect(separateDegrees(moonOf(chart), moonOf(natal))).toBeLessThan(1e-5);
  });

  it("keeps the natal chart's house system and aspect settings", () => {
    const { chart } = createLunarReturn(
      natal,
      { year: 2026, month: 11, day: 17 },
      TOKYO,
    );

    expect(chart.details.houseSystem).toBe(HouseSystem.Koch);
    expect(chart.details.aspectSettings).toBe(BIRTH.aspectSettings);
  });

  it("gives the moment on the place's own clock", () => {
    const { chart } = createLunarReturn(
      natal,
      { year: 2026, month: 11, day: 17 },
      TOKYO,
    );
    const local = toLocal(chart.bornAt, TOKYO.timeZone);

    expect(chart.details.date).toEqual({
      year: local.year,
      month: local.month,
      day: local.day,
    });
    expect(chart.details.time).toEqual({
      hour: local.hour,
      minute: local.minute,
    });
  });

  it("shows the return that comes on the date asked for", () => {
    const first = createLunarReturn(
      natal,
      { year: 2026, month: 11, day: 17 },
      TOKYO,
    );

    // Asking for the return's own date, on the clock where it's cast,
    // finds the same return, whatever time of day it came.
    const again = createLunarReturn(natal, first.chart.details.date, TOKYO);
    expect(isSameMoment(again.chart.bornAt, first.chart.bornAt)).toBe(true);
  });

  it("shows the next return from the day it comes", () => {
    const first = createLunarReturn(
      natal,
      { year: 2026, month: 11, day: 17 },
      TOKYO,
    );
    const nextMoment = findLunarReturn(
      natal,
      new Date(first.chart.bornAt.getTime() + LONGEST_MONTH_MS),
    );
    const nextDate = toLocal(nextMoment, TOKYO.timeZone);

    const next = createLunarReturn(natal, nextDate, TOKYO);
    expect(isSameMoment(next.chart.bornAt, nextMoment)).toBe(true);
  });

  it("rolls over the end of a year", () => {
    const { chart } = createLunarReturn(
      natal,
      { year: 2026, month: 12, day: 31 },
      TOKYO,
    );

    expect(chart.bornAt.getTime()).toBeLessThan(
      new Date("2026-12-31T15:00Z").getTime(),
    );
  });
});
