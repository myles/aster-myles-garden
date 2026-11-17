import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

import { ASPECT_INFO, AspectType, type Aspect } from "@/lib/astrology/aspects";
import { Body } from "@/lib/astrology/bodies";
import { HouseSystem } from "@/lib/astrology/houses";
import { separateDegrees } from "@/lib/astrology/zodiac";
import { createChart } from "@/lib/charts/chart";
import { findTransitTiming } from "@/lib/charts/transit-timing";
import { createTransits } from "@/lib/charts/transits";
import {
  browserEphemeris,
  loadEphemeris,
  type Ephemeris,
} from "@/lib/engine/ephemeris";
import { fromJulianDay, toJulianDay } from "@/lib/time";

const WASM_PATH = "node_modules/@swisseph/browser/dist/swisseph.wasm";
const WASM_DATA_URL =
  "data:application/wasm;base64," + readFileSync(WASM_PATH).toString("base64");

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/** A starting day to measure the made-up planets' motion from. */
const EPOCH = toJulianDay(new Date("2026-01-01T00:00:00Z"));
const AT_EPOCH = fromJulianDay(EPOCH);

/** An ephemeris with one body, Saturn, wherever `longitudeAt` puts it. */
function fakeEphemeris(longitudeAt: (days: number) => number): Ephemeris {
  const saturnAt = (julianDay: number) => ({
    body: Body.Saturn,
    longitude: longitudeAt(julianDay - EPOCH),
    latitude: 0,
    speed: 0,
  });

  return {
    calculateBodies: (julianDay) => [saturnAt(julianDay)],
    calculateBody: saturnAt,
    calculateAyanamsa: () => 0,
    calculateHouses: () => {
      throw new Error("Not used.");
    },
  };
}

const conjunction = (orbDegrees: number): Aspect => ({
  first: Body.Sun,
  second: Body.Saturn,
  type: AspectType.Conjunction,
  orbDegrees,
});

/** Days since EPOCH. */
const daysOf = (at: Date | undefined) =>
  ((at?.getTime() ?? NaN) - AT_EPOCH.getTime()) / MS_PER_DAY;

/** Within about a minute, as the search promises. */
const MINUTE_IN_DAYS = MS_PER_MINUTE / MS_PER_DAY;

describe("findTransitTiming", () => {
  it("finds a direct pass: into orb, exact, and out", () => {
    // 0.1° a day, from 99° at the epoch, past a natal body at 100°.
    const ephemeris = fakeEphemeris((days) => 99 + 0.1 * days);

    const timing = findTransitTiming(
      conjunction(1),
      100,
      AT_EPOCH,
      2,
      ephemeris,
    );

    expect(daysOf(timing.entersOrb)).toBeCloseTo(-10, 2);
    expect(timing.exact).toHaveLength(1);
    expect(daysOf(timing.exact[0])).toBeCloseTo(10, 2);
    expect(daysOf(timing.leavesOrb)).toBeCloseTo(30, 2);
  });

  it("finds every exact moment as it loops back and forth", () => {
    // Drifting forward 0.002° a day, with a half-degree swing each 200
    // days, so it crosses 100° five times before going on for good.
    const ephemeris = fakeEphemeris(
      (days) =>
        99.7 + 0.002 * days + 0.5 * Math.sin((2 * Math.PI * days) / 200),
    );
    const missAt = (at: Date) =>
      separateDegrees(
        ephemeris.calculateBodies(toJulianDay(at))[0].longitude,
        100,
      );

    const timing = findTransitTiming(
      conjunction(0),
      100,
      AT_EPOCH,
      2,
      ephemeris,
    );

    expect(timing.exact.map((at) => Math.round(daysOf(at)))).toEqual([
      18, 93, 194, 325, 367,
    ]);
    for (const exact of timing.exact) {
      expect(missAt(exact)).toBeLessThan(0.001);
    }
    expect(timing.exact).toEqual(
      timing.exact.toSorted((a, b) => a.getTime() - b.getTime()),
    );
    expect(timing.entersOrb!.getTime()).toBeLessThan(timing.exact[0].getTime());
    expect(timing.leavesOrb!.getTime()).toBeGreaterThan(
      timing.exact[4].getTime(),
    );
  });

  it("has no exact moment when the planet turns back short of it", () => {
    // Swings from 98.5° up to 99.5° and back, never reaching 100°.
    const ephemeris = fakeEphemeris(
      (days) => 99 + 0.5 * Math.sin((2 * Math.PI * days) / 400),
    );

    const timing = findTransitTiming(
      conjunction(1),
      100,
      AT_EPOCH,
      2,
      ephemeris,
    );

    expect(timing.exact).toEqual([]);
  });

  it("measures from the aspect's own point, either side", () => {
    // A square to 100° is exact at 10° or at 190°; this one nears 10°.
    const ephemeris = fakeEphemeris((days) => 9 + 0.1 * days);
    const square = { ...conjunction(1), type: AspectType.Square };

    const timing = findTransitTiming(square, 100, AT_EPOCH, 2, ephemeris);

    expect(daysOf(timing.exact[0])).toBeCloseTo(10, 2);
  });

  it("finds the moments to within a minute", () => {
    const ephemeris = fakeEphemeris((days) => 99 + 0.1 * days);

    const timing = findTransitTiming(
      conjunction(1),
      100,
      AT_EPOCH,
      2,
      ephemeris,
    );

    expect(Math.abs(daysOf(timing.exact[0]) - 10)).toBeLessThan(MINUTE_IN_DAYS);
  });

  it("leaves the ends out when they're beyond the search", () => {
    // Barely moving: in orb for longer than the search reaches.
    const ephemeris = fakeEphemeris((days) => 99 + 0.0001 * days);

    const timing = findTransitTiming(
      conjunction(1),
      100,
      AT_EPOCH,
      2,
      ephemeris,
    );

    expect(timing.entersOrb).toBeUndefined();
    expect(timing.leavesOrb).toBeUndefined();
  });

  it("keeps the number of steps down for a slow planet", () => {
    let steps = 0;
    const ephemeris = fakeEphemeris((days) => {
      steps++;
      return 99.7 + 0.002 * days + 0.5 * Math.sin((2 * Math.PI * days) / 200);
    });

    const timing = findTransitTiming(
      conjunction(0),
      100,
      AT_EPOCH,
      2,
      ephemeris,
    );

    // A fixed step short enough not to miss an exact moment would take
    // about 15 a day: some 25,000 over this four-and-a-half-year pass.
    const passDays = daysOf(timing.leavesOrb) - daysOf(timing.entersOrb);
    expect(passDays).toBeGreaterThan(1500);
    expect(steps).toBeLessThan(passDays);
  });
});

describe("transit timing from the real engine", () => {
  beforeAll(async () => {
    await loadEphemeris(WASM_DATA_URL);
  });

  it("brackets the moment shown and is exact where it says", () => {
    const natal = createChart({
      date: { year: 2000, month: 1, day: 1 },
      time: { hour: 7, minute: 0 },
      place: {
        id: 6167865,
        name: "Toronto",
        region: "Ontario",
        country: "Canada",
        latitude: 43.7064,
        longitude: -79.3986,
        timeZone: "America/Toronto",
      },
      houseSystem: HouseSystem.Placidus,
    });
    const at = new Date("2026-11-13T20:00:00Z");
    const transits = createTransits(natal, at, browserEphemeris);

    expect(transits.aspects.length).toBeGreaterThan(0);
    for (const aspect of transits.aspects) {
      const { entersOrb, exact, leavesOrb } = aspect.timing;
      const label = `${aspect.second} ${aspect.type} ${aspect.first}`;

      if (entersOrb) {
        expect(entersOrb.getTime(), label).toBeLessThanOrEqual(at.getTime());
      }
      if (leavesOrb) {
        expect(leavesOrb.getTime(), label).toBeGreaterThanOrEqual(at.getTime());
      }
      for (const moment of exact) {
        const natalBody = natal.bodies.find((b) => b.body === aspect.first)!;
        const transiting = createTransits(natal, moment).bodies.find(
          (b) => b.body === aspect.second,
        )!;
        const separation = separateDegrees(
          transiting.longitude,
          natalBody.longitude,
        );
        const angle = ASPECT_INFO[aspect.type].angleDegrees;
        expect(Math.abs(separation - angle), label).toBeLessThan(0.01);
      }
    }
  });
});
