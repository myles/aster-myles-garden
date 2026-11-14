import { describe, expect, it } from "vitest";

import { Body } from "@/lib/astrology/bodies";
import {
  findHouse,
  HouseSystem,
  isHouseSystem,
  placeInHouses,
} from "@/lib/astrology/houses";

const EQUAL_CUSPS = Array.from({ length: 12 }, (_, i) => i * 30);
// Cusps that wrap past 0° Aries partway round.
const WRAPPING_CUSPS = Array.from(
  { length: 12 },
  (_, i) => (300 + i * 30) % 360,
);

describe("findHouse", () => {
  it("places longitudes between cusps", () => {
    expect(findHouse(0, EQUAL_CUSPS)).toBe(1);
    expect(findHouse(45, EQUAL_CUSPS)).toBe(2);
    expect(findHouse(359, EQUAL_CUSPS)).toBe(12);
  });

  it("handles houses that span 0° Aries", () => {
    expect(findHouse(310, WRAPPING_CUSPS)).toBe(1);
    expect(findHouse(15, WRAPPING_CUSPS)).toBe(3);
    expect(findHouse(299, WRAPPING_CUSPS)).toBe(12);
  });
});

describe("placeInHouses", () => {
  const houses = {
    cusps: EQUAL_CUSPS,
    ascendant: 0,
    midheaven: 270,
    houseSystem: HouseSystem.Equal,
  };

  it("finds the house each body falls in", () => {
    const bodies = [
      { body: Body.Sun, longitude: 45 },
      { body: Body.Moon, longitude: 359 },
    ];

    expect(placeInHouses(bodies, houses)).toEqual({
      [Body.Sun]: 2,
      [Body.Moon]: 12,
    });
  });

  it("has nothing to place bodies in without houses", () => {
    expect(
      placeInHouses([{ body: Body.Sun, longitude: 45 }], undefined),
    ).toBeUndefined();
  });
});

describe("isHouseSystem", () => {
  it("accepts known systems only", () => {
    expect(isHouseSystem("placidus")).toBe(true);
    expect(isHouseSystem("P")).toBe(false);
  });
});
