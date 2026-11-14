import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

import {
  ASPECT_INFO,
  AspectRank,
  AspectSet,
  DEFAULT_ASPECT_SETTINGS,
} from "@/lib/aspects";
import { Body } from "@/lib/bodies";
import { createChart, type BirthDetails, type Chart } from "@/lib/chart";
import { createComposite, findMidpoint } from "@/lib/composite";
import { browserEphemeris, loadEphemeris } from "@/lib/ephemeris";
import { HouseSystem } from "@/lib/houses";
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

// Tromsø and Murmansk, both inside the Arctic Circle.
const TROMSO = { ...LONDON, id: 1, latitude: 69.65, longitude: 18.96 };
const MURMANSK = { ...LONDON, id: 2, latitude: 68.97, longitude: 33.09 };

const YOURS: BirthDetails = {
  date: { year: 2000, month: 1, day: 1 },
  time: { hour: 7, minute: 0 },
  place: TORONTO,
  houseSystem: HouseSystem.Placidus,
};

const THEIRS: BirthDetails = {
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 14, minute: 30 },
  place: LONDON,
  houseSystem: HouseSystem.Placidus,
};

describe("findMidpoint", () => {
  it.each([
    [10, 80, 45],
    [80, 10, 45],
    // The nearer midpoint, across 0° Aries.
    [350, 20, 5],
    // 200° apart one way, 160° the other: the nearer side wins.
    [100, 300, 20],
  ])("finds the midpoint of %s° and %s° at %s°", (a, b, midpoint) => {
    expect(findMidpoint(a, b)).toBeCloseTo(midpoint, 9);
  });
});

describe("createComposite", () => {
  let yours: Chart;
  let theirs: Chart;

  beforeAll(async () => {
    await loadEphemeris(WASM_DATA_URL);
    yours = createChart(YOURS);
    theirs = createChart(THEIRS);
  });

  // Whether the composite with them has any minor aspects.
  const isMinor = (chart: Chart) =>
    createComposite(chart, theirs).aspects.some(
      (aspect) => ASPECT_INFO[aspect.type].rank === AspectRank.Minor,
    );

  it("keeps both charts, yours first", () => {
    const composite = createComposite(yours, theirs);

    expect(composite.first).toBe(yours);
    expect(composite.second).toBe(theirs);
  });

  it("puts each body at the midpoint of the two", () => {
    const composite = createComposite(yours, theirs);

    composite.bodies.forEach((placed, index) => {
      expect(placed.body).toBe(yours.bodies[index].body);
      expect(placed.longitude).toBeCloseTo(
        findMidpoint(
          yours.bodies[index].longitude,
          theirs.bodies[index].longitude,
        ),
        9,
      );
      // A composite isn't a moment, so nothing in it moves.
      expect(placed.speed).toBe(0);
      expect(placed.isRetrograde).toBe(false);
    });
  });

  it("keeps the nodes opposite each other", () => {
    const { bodies } = createComposite(yours, theirs);
    const longitudeOf = (body: Body) =>
      bodies.find((placed) => placed.body === body)!.longitude;

    expect(
      separateDegrees(longitudeOf(Body.NorthNode), longitudeOf(Body.SouthNode)),
    ).toBeCloseTo(180, 6);
  });

  it("casts houses from the midpoint of the two midheavens", () => {
    const { houses } = createComposite(yours, theirs);

    expect(houses?.midheaven).toBeCloseTo(
      findMidpoint(yours.houses!.midheaven, theirs.houses!.midheaven),
      6,
    );
    expect(houses?.houseSystem).toBe(HouseSystem.Placidus);
    expect(houses?.cusps).toHaveLength(12);
    expect(houses?.cusps[0]).toBeCloseTo(houses!.ascendant, 6);
  });

  it("finds the midheaven in a few casts", () => {
    let casts = 0;
    const counting = {
      ...browserEphemeris,
      calculateHouses: (
        ...args: Parameters<typeof browserEphemeris.calculateHouses>
      ) => {
        casts++;
        return browserEphemeris.calculateHouses(...args);
      },
    };

    createComposite(yours, theirs, counting);

    expect(casts).toBeLessThanOrEqual(8);
  });

  it("places every body in a composite house", () => {
    for (const placed of createComposite(yours, theirs).bodies) {
      expect(placed.house).toBeGreaterThanOrEqual(1);
      expect(placed.house).toBeLessThanOrEqual(12);
    }
  });

  it("has no houses when either birth time is unknown", () => {
    const timeless = createChart({ ...THEIRS, time: undefined });
    const composite = createComposite(yours, timeless);

    expect(composite.houses).toBeUndefined();
    expect(composite.bodies.every((placed) => !placed.house)).toBe(true);
  });

  it("falls back to Porphyry inside the polar circles", () => {
    const composite = createComposite(
      createChart({ ...YOURS, place: TROMSO }),
      createChart({ ...THEIRS, place: MURMANSK }),
    );

    expect(composite.houses?.houseSystem).toBe(HouseSystem.Porphyry);
  });

  it("finds aspects with your chart's settings", () => {
    const withMinor = createChart({
      ...YOURS,
      aspectSettings: { ...DEFAULT_ASPECT_SETTINGS, aspectSet: AspectSet.All },
    });

    expect(isMinor(yours)).toBe(false);
    expect(isMinor(withMinor)).toBe(true);
  });
});
