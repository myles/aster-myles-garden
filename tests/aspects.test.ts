import { describe, expect, it } from "vitest";

import { AspectType, findAspects } from "@/lib/aspects";
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
