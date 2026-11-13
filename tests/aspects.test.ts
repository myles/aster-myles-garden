import { describe, expect, it } from "vitest";

import { AspectType, findAspects, findAspectsBetween } from "@/lib/aspects";
import { Body } from "@/lib/bodies";
import type { BodyPosition } from "@/lib/ephemeris";

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

  it("leaves out points such as the node", () => {
    expect(
      findAspectsBetween([at(Body.NorthNode, 10)], [at(Body.Sun, 10)]),
    ).toEqual([]);
  });
});
