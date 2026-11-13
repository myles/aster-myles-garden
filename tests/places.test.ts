import { describe, expect, it } from "vitest";

import {
  findPlace,
  formatPlace,
  normalizeSearchText,
  parsePlaceIndex,
  searchPlaces,
  type RawPlaceIndex,
} from "@/lib/places";

// Rows are pre-sorted by population, as the build script writes them.
const RAW_INDEX: RawPlaceIndex = {
  timeZones: ["Europe/London", "America/Toronto", "America/Montreal"],
  places: [
    [
      "London",
      "",
      "England",
      "United Kingdom",
      51.5085,
      -0.1257,
      0,
      8961989,
      2643743,
    ],
    [
      "Toronto",
      "",
      "Ontario",
      "Canada",
      43.7064,
      -79.3986,
      1,
      2600000,
      6167865,
    ],
    [
      "Montréal",
      "Montreal",
      "Quebec",
      "Canada",
      45.5088,
      -73.5878,
      2,
      1600000,
      6077243,
    ],
    ["London", "", "Ontario", "Canada", 42.9834, -81.233, 1, 346765, 6058560],
    [
      "East London",
      "",
      "Eastern Cape",
      "South Africa",
      -33.0153,
      27.9116,
      0,
      478676,
      1006984,
    ],
  ],
};

const index = parsePlaceIndex(RAW_INDEX);
const names = (query: string) => searchPlaces(index, query).map(formatPlace);

describe("normalizeSearchText", () => {
  it("folds case and strips diacritics", () => {
    expect(normalizeSearchText("  Montréal ")).toBe("montreal");
  });
});

describe("parsePlaceIndex", () => {
  it("resolves time zone indices", () => {
    expect(index.entries[1].place).toEqual({
      id: 6167865,
      name: "Toronto",
      region: "Ontario",
      country: "Canada",
      latitude: 43.7064,
      longitude: -79.3986,
      timeZone: "America/Toronto",
    });
  });
});

describe("findPlace", () => {
  it("finds a place by its GeoNames ID", () => {
    expect(findPlace(index, 6058560)).toMatchObject({
      name: "London",
      region: "Ontario",
    });
  });

  it("returns undefined for an unknown ID", () => {
    expect(findPlace(index, 1)).toBeUndefined();
  });
});

describe("searchPlaces", () => {
  it("ranks prefix matches by population, then inner matches", () => {
    expect(names("lon")).toEqual([
      "London, England, United Kingdom",
      "London, Ontario, Canada",
      "East London, Eastern Cape, South Africa",
    ]);
  });

  it("narrows by region or country after a comma", () => {
    expect(names("london, canada")).toEqual(["London, Ontario, Canada"]);
    expect(names("london, ontario")).toEqual(["London, Ontario, Canada"]);
  });

  it("matches without diacritics", () => {
    expect(names("montreal")).toEqual(["Montréal, Quebec, Canada"]);
  });

  it("returns nothing for an empty query", () => {
    expect(names("  ")).toEqual([]);
  });

  it("respects the limit", () => {
    expect(searchPlaces(index, "lon", 1)).toHaveLength(1);
  });
});
