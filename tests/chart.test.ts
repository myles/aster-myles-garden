import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

import { Body } from "@/lib/bodies";
import {
  canCalculateDate,
  canCalculateMoment,
  createChart,
  usesFallbackHouses,
  type Chart,
} from "@/lib/chart";
import { loadEphemeris } from "@/lib/ephemeris";
import { HOUSE_COUNT, HouseSystem } from "@/lib/houses";

import { CHART, CHART_WITHOUT_TIME, POLAR_CHART } from "./fixtures/chart";

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

describe("createChart", () => {
  let chart: Chart;

  beforeAll(async () => {
    await loadEphemeris(WASM_DATA_URL);
    chart = createChart({
      date: { year: 2000, month: 1, day: 1 },
      time: { hour: 7, minute: 0 },
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

describe("createChart without a birth time", () => {
  const signNames = (chart: Chart, body: Body) =>
    chart.bodies
      .find((placed) => placed.body === body)
      ?.possibleSigns?.map((sign) => sign.name);

  let quiet: Chart;
  let cusp: Chart;

  beforeAll(async () => {
    await loadEphemeris(WASM_DATA_URL);
    quiet = createChart({
      date: { year: 2000, month: 1, day: 1 },
      place: TORONTO,
      houseSystem: HouseSystem.Placidus,
    });
    // The Sun enters Aquarius and the Moon enters Leo during this day.
    cusp = createChart({
      date: { year: 2000, month: 1, day: 20 },
      place: TORONTO,
      houseSystem: HouseSystem.Placidus,
    });
  });

  it("calculates for local noon", () => {
    expect(quiet.bornAt.toISOString()).toBe("2000-01-01T17:00:00.000Z");
  });

  it("leaves out houses, which need a birth time", () => {
    expect(quiet.houses).toBeUndefined();
    for (const body of quiet.bodies) {
      expect(body.house).toBeUndefined();
    }
  });

  it("keeps the aspects", () => {
    expect(quiet.aspects.length).toBeGreaterThan(0);
  });

  it("gives one possible sign when a body stays put all day", () => {
    expect(signNames(quiet, Body.Moon)).toEqual(["Scorpio"]);
  });

  it("gives both signs when a body changes sign that day", () => {
    expect(signNames(cusp, Body.Sun)).toEqual(["Capricorn", "Aquarius"]);
    expect(signNames(cusp, Body.Moon)).toEqual(["Cancer", "Leo"]);
    expect(signNames(cusp, Body.Mars)).toEqual(["Pisces"]);
  });

  it("leaves possible signs out when the time is known", () => {
    const known = createChart({
      date: { year: 2000, month: 1, day: 20 },
      time: { hour: 12, minute: 0 },
      place: TORONTO,
      houseSystem: HouseSystem.Placidus,
    });

    for (const body of known.bodies) {
      expect(body.possibleSigns).toBeUndefined();
    }
  });
});

describe("usesFallbackHouses", () => {
  it("is true when the houses were cast with another system", () => {
    expect(usesFallbackHouses(POLAR_CHART)).toBe(true);
  });

  it("is false when the houses use the system asked for", () => {
    expect(usesFallbackHouses(CHART)).toBe(false);
  });

  it("is false without houses", () => {
    expect(usesFallbackHouses(CHART_WITHOUT_TIME)).toBe(false);
  });
});

describe("canCalculateMoment", () => {
  it("accepts moments the engine covers", () => {
    expect(canCalculateMoment(new Date("2000-01-01T12:00:00Z"))).toBe(true);
    expect(canCalculateMoment(new Date("3003-04-28T23:59:00Z"))).toBe(true);
  });

  it("rejects moments past its end", () => {
    expect(canCalculateMoment(new Date("3003-04-29T00:01:00Z"))).toBe(false);
    expect(canCalculateMoment(new Date("9999-01-01T00:00:00Z"))).toBe(false);
  });
});

describe("canCalculateDate", () => {
  it("accepts dates the engine covers", () => {
    const date = { year: 1, month: 1, day: 1 };

    expect(canCalculateDate(date, "UTC")).toBe(true);
  });

  it("checks the whole local day", () => {
    // 28 April 3003 ends after the engine does, west of UTC.
    const date = { year: 3003, month: 4, day: 28 };

    expect(canCalculateDate(date, "UTC")).toBe(true);
    expect(canCalculateDate(date, "America/Toronto")).toBe(false);
  });

  it("rejects dates past its end", () => {
    expect(canCalculateDate({ year: 9999, month: 1, day: 1 }, "UTC")).toBe(
      false,
    );
  });
});
