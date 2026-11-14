import { describe, expect, it } from "vitest";

import type { BodyPosition } from "@/lib/ephemeris";

import {
  AspectSet,
  AspectType,
  DEFAULT_ASPECT_SETTINGS,
  findAspects,
  findAspectsBetween,
  isAspectSet,
  isOrbSize,
  OrbSize,
} from "@/lib/aspects";
import { Body } from "@/lib/bodies";

const at = (body: Body, longitude: number): BodyPosition => ({
  body,
  longitude,
  latitude: 0,
  speed: 1,
});

describe("findAspects", () => {
  it("finds aspects within orb, tightest first", () => {
    const aspects = findAspects([
      at(Body.Sun, 10),
      at(Body.Moon, 135),
      at(Body.Mars, 190.5),
    ]);

    expect(aspects).toEqual([
      {
        first: Body.Sun,
        second: Body.Mars,
        type: AspectType.Opposition,
        orbDegrees: 0.5,
      },
      {
        first: Body.Sun,
        second: Body.Moon,
        type: AspectType.Trine,
        orbDegrees: 5,
      },
    ]);
  });

  it("measures across 0° Aries", () => {
    const aspects = findAspects([at(Body.Sun, 355), at(Body.Venus, 3)]);
    expect(aspects[0].type).toBe(AspectType.Conjunction);
    expect(aspects[0].orbDegrees).toBeCloseTo(8);
  });

  it("ignores pairs outside every orb", () => {
    expect(findAspects([at(Body.Sun, 0), at(Body.Moon, 45)])).toEqual([]);
  });

  it("leaves out points such as the node", () => {
    expect(findAspects([at(Body.Sun, 0), at(Body.NorthNode, 0)])).toEqual([]);
  });

  it("leaves out minor aspects by default", () => {
    expect(findAspects([at(Body.Sun, 0), at(Body.Moon, 150)])).toEqual([]);
  });

  it.each([
    [31, AspectType.SemiSextile],
    [44, AspectType.SemiSquare],
    [135.5, AspectType.Sesquiquadrate],
    [151, AspectType.Quincunx],
  ])("finds %s° apart as a %s when minor aspects are on", (moon, type) => {
    const settings = { ...DEFAULT_ASPECT_SETTINGS, aspectSet: AspectSet.All };
    const [aspect] = findAspects(
      [at(Body.Sun, 0), at(Body.Moon, moon)],
      settings,
    );

    expect(aspect.type).toBe(type);
  });

  it("scales every orb by the orb size", () => {
    // 7.5° past a square: outside its 7° orb, inside a wide one (8.75°).
    const positions = [at(Body.Sun, 0), at(Body.Moon, 97.5)];
    const sized = (orbSize: OrbSize) =>
      findAspects(positions, { ...DEFAULT_ASPECT_SETTINGS, orbSize });

    expect(sized(OrbSize.Standard)).toEqual([]);
    expect(sized(OrbSize.Wide)).toHaveLength(1);
    expect(
      findAspects([at(Body.Sun, 0), at(Body.Moon, 95.5)], {
        ...DEFAULT_ASPECT_SETTINGS,
        orbSize: OrbSize.Tight,
      }),
    ).toEqual([]);
  });
});

describe("isAspectSet and isOrbSize", () => {
  it("accept only known values", () => {
    expect(isAspectSet("all")).toBe(true);
    expect(isAspectSet("minor")).toBe(false);
    expect(isOrbSize("wide")).toBe(true);
    expect(isOrbSize("huge")).toBe(false);
  });
});

describe("findAspectsBetween", () => {
  it("pairs every body in one set with every body in the other", () => {
    const aspects = findAspectsBetween(
      [at(Body.Sun, 10), at(Body.Moon, 100)],
      [at(Body.Sun, 12), at(Body.Venus, 190)],
    );

    expect(aspects).toEqual([
      {
        first: Body.Sun,
        second: Body.Venus,
        type: AspectType.Opposition,
        orbDegrees: 0,
      },
      {
        first: Body.Moon,
        second: Body.Venus,
        type: AspectType.Square,
        orbDegrees: 0,
      },
      {
        first: Body.Sun,
        second: Body.Sun,
        type: AspectType.Conjunction,
        orbDegrees: 2,
      },
      {
        first: Body.Moon,
        second: Body.Sun,
        type: AspectType.Square,
        orbDegrees: 2,
      },
    ]);
  });

  it("keeps each body on its own side", () => {
    const [aspect] = findAspectsBetween([at(Body.Mars, 0)], [at(Body.Sun, 90)]);

    expect(aspect).toMatchObject({ first: Body.Mars, second: Body.Sun });
  });

  it("can cap the orb below each aspect's own", () => {
    const yours = [at(Body.Sun, 0)];
    const theirs = [at(Body.Mars, 92.5), at(Body.Venus, 181.5)];

    // Without a cap both count: squares allow 7° and oppositions 8°.
    expect(findAspectsBetween(yours, theirs)).toHaveLength(2);
    expect(
      findAspectsBetween(yours, theirs, DEFAULT_ASPECT_SETTINGS, 2),
    ).toEqual([
      {
        first: Body.Sun,
        second: Body.Venus,
        type: AspectType.Opposition,
        orbDegrees: 1.5,
      },
    ]);
  });

  it("leaves out points such as the node", () => {
    expect(
      findAspectsBetween([at(Body.NorthNode, 10)], [at(Body.Sun, 10)]),
    ).toEqual([]);
  });
});
