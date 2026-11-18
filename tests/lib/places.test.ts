import { describe, expect, it } from "vitest";

import {
  createCoordinatePlace,
  findNearestPlace,
  findPlace,
  formatPlace,
  normalizeSearchText,
  parseCoordinates,
  parsePlaceIndex,
  searchPlaces,
  type RawPlaceIndex,
} from "@/lib/places";

// Rows are pre-sorted by population, as the build script writes them.
const RAW_INDEX: RawPlaceIndex = {
  timeZones: ["Europe/London", "America/Toronto", "America/Montreal"],
  places: [
    ["London", "", "England", "United Kingdom", 51.5085, -0.1257, 0, 2643743],
    ["Toronto", "", "Ontario", "Canada", 43.7064, -79.3986, 1, 6167865],
    ["Montréal", "Montreal", "Quebec", "Canada", 45.5088, -73.5878, 2, 6077243],
    ["London", "", "Ontario", "Canada", 42.9834, -81.233, 1, 6058560],
    [
      "East London",
      "",
      "Eastern Cape",
      "South Africa",
      -33.0153,
      27.9116,
      0,
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

describe("findNearestPlace", () => {
  it("finds the closest listed place and how far it is", () => {
    // Brampton, just north-west of Toronto.
    const nearest = findNearestPlace(index, 43.6833, -79.7667);

    expect(nearest?.place.name).toBe("Toronto");
    expect(nearest?.distanceKm).toBeCloseTo(29.6, 0);
  });

  it("measures across the antimeridian", () => {
    const wrapping = parsePlaceIndex({
      timeZones: ["Pacific/Fiji", "Pacific/Pago_Pago"],
      places: [
        ["Suva", "", "Central", "Fiji", -18.1416, 178.4415, 0, 2198148],
        ["Apia", "", "Tuamasaga", "Samoa", -13.8333, -171.7667, 1, 4035413],
      ],
    });

    // Just west of the 180° line, Fiji is nearer than Samoa.
    expect(findNearestPlace(wrapping, -17, 179.9)?.place.name).toBe("Suva");
    // Just east of it, Samoa is.
    expect(findNearestPlace(wrapping, -14, -172)?.place.name).toBe("Apia");
  });

  it("finds nothing in an empty index", () => {
    expect(findNearestPlace({ entries: [] }, 0, 0)).toBeUndefined();
  });
});

describe("parseCoordinates", () => {
  it("reads latitude and longitude as maps copy them", () => {
    expect(parseCoordinates("43.70640, -79.39860")).toEqual({
      latitude: 43.7064,
      longitude: -79.3986,
    });
  });

  it("accepts spaces instead of a comma", () => {
    expect(parseCoordinates("  -33.9  151.2 ")).toEqual({
      latitude: -33.9,
      longitude: 151.2,
    });
  });

  it("rounds to four decimal places, about 11 metres", () => {
    expect(parseCoordinates("1.234567, 2.345678")).toEqual({
      latitude: 1.2346,
      longitude: 2.3457,
    });
  });

  it.each([
    ["", "Enter a latitude and longitude"],
    ["43.7", "Enter a latitude and longitude"],
    ["north, west", "Enter a latitude and longitude"],
    ["91, 0", "Latitude must be between -90 and 90."],
    ["0, 181", "Longitude must be between -180 and 180."],
  ])("rejects %j", (text, message) => {
    expect(() => parseCoordinates(text)).toThrow(message);
  });
});

describe("createCoordinatePlace", () => {
  it("makes a place with no GeoNames ID", () => {
    expect(
      createCoordinatePlace({
        name: "  Smallville ",
        latitude: 43.7,
        longitude: -79.4,
        timeZone: "America/Toronto",
      }),
    ).toEqual({
      name: "Smallville",
      region: "",
      country: "",
      latitude: 43.7,
      longitude: -79.4,
      timeZone: "America/Toronto",
    });
  });

  it("names an unnamed place by its coordinates", () => {
    const place = createCoordinatePlace({
      name: "",
      latitude: 43.7,
      longitude: -79.4,
      timeZone: "America/Toronto",
    });

    expect(place.name).toBe("43.70° N, 79.40° W");
    expect(place.id).toBeUndefined();
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
