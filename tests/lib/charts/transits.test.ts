import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

import {
  ASPECT_INFO,
  AspectRank,
  AspectSet,
  AspectType,
  DEFAULT_ASPECT_SETTINGS,
} from "@/lib/astrology/aspects";
import { Body } from "@/lib/astrology/bodies";
import { HouseSystem } from "@/lib/astrology/houses";
import { createChart, type Chart } from "@/lib/charts/chart";
import { createTransits, TRANSIT_MAX_ORB_DEGREES } from "@/lib/charts/transits";
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

/** Minor aspects in the transits for the moment of birth. */
function countMinor(chart: Chart): number {
  return createTransits(chart, chart.bornAt).aspects.filter(
    (aspect) => ASPECT_INFO[aspect.type].rank === AspectRank.Minor,
  ).length;
}

describe("createTransits", () => {
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

  it("calculates the sky at the moment given", () => {
    const at = new Date("2026-11-13T20:00:00Z");
    const transits = createTransits(natal, at);

    expect(transits.natal).toBe(natal);
    expect(transits.at).toBe(at);
    expect(transits.bodies).toHaveLength(natal.bodies.length);
    for (const body of transits.bodies) {
      expect(body.house).toBeUndefined();
      expect(body.isRetrograde).toBe(body.speed < 0);
    }
  });

  it("uses the natal chart's aspect settings", () => {
    const withMinor = createChart({
      ...natal.details,
      aspectSettings: { ...DEFAULT_ASPECT_SETTINGS, aspectSet: AspectSet.All },
    });
    expect(countMinor(natal)).toBe(0);
    expect(countMinor(withMinor)).toBeGreaterThan(0);
  });

  it("matches the natal chart at the moment of birth", () => {
    const transits = createTransits(natal, natal.bornAt);

    // Every planet sits on itself, and in its own natal house.
    expect(transits.aspects).toContainEqual(
      expect.objectContaining({
        first: Body.Sun,
        second: Body.Sun,
        type: AspectType.Conjunction,
        orbDegrees: 0,
      }),
    );
    const sun = natal.bodies.find((placed) => placed.body === Body.Sun);
    expect(transits.inNatalHouses?.[Body.Sun]).toBe(sun?.house);
  });

  it("times each transit around the moment shown", () => {
    const at = new Date("2026-11-13T20:00:00Z");
    const transits = createTransits(natal, at);

    for (const { timing } of transits.aspects) {
      expect(timing.entersOrb!.getTime()).toBeLessThan(at.getTime());
      expect(timing.leavesOrb!.getTime()).toBeGreaterThan(at.getTime());
    }
  });

  it("only counts aspects within the transit orb", () => {
    const transits = createTransits(natal, new Date("2026-11-13T20:00:00Z"));

    for (const aspect of transits.aspects) {
      expect(aspect.orbDegrees).toBeLessThanOrEqual(TRANSIT_MAX_ORB_DEGREES);
    }
  });

  it("has no natal houses to place transits in without a birth time", () => {
    const untimed = createChart({ ...natal.details, time: undefined });
    const transits = createTransits(untimed, natal.bornAt);

    expect(transits.inNatalHouses).toBeUndefined();
  });
});
