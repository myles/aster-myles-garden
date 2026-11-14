import { describe, expect, it } from "vitest";

import {
  chartRequestSchemaV1,
  formatValidationError,
  placesQuerySchemaV1,
} from "@/lib/api/schemas";
import { HouseSystem } from "@/lib/houses";

const VALID_REQUEST = {
  date: "1990-05-15",
  time: "14:30",
  latitude: 43.7064,
  longitude: -79.3986,
  timeZone: "America/Toronto",
};

describe("chartRequestSchemaV1", () => {
  it("accepts birth details and defaults the house system", () => {
    const parsed = chartRequestSchemaV1.parse(VALID_REQUEST);

    expect(parsed).toEqual({
      ...VALID_REQUEST,
      houseSystem: HouseSystem.Placidus,
    });
  });

  it("accepts a chart without a birth time", () => {
    const { time: _time, ...withoutTime } = VALID_REQUEST;

    expect(chartRequestSchemaV1.safeParse(withoutTime).success).toBe(true);
  });

  it.each([
    ["an impossible date", { date: "2024-02-31" }],
    ["an impossible time", { time: "99:99" }],
    ["a 12-hour time", { time: "2:30" }],
    ["a latitude past the pole", { latitude: 91 }],
    ["a longitude past the antimeridian", { longitude: -181 }],
    ["a coordinate as text", { latitude: "43.7" }],
    ["an unknown time zone", { timeZone: "Mars/Olympus_Mons" }],
    ["an unknown house system", { houseSystem: "topocentric" }],
    ["an undeclared field", { place: 6167865 }],
  ])("rejects %s", (_label, change) => {
    const result = chartRequestSchemaV1.safeParse({
      ...VALID_REQUEST,
      ...change,
    });

    expect(result.success).toBe(false);
  });
});

describe("placesQuerySchemaV1", () => {
  it("trims the query and defaults the limit", () => {
    expect(placesQuerySchemaV1.parse({ q: "  toronto " })).toEqual({
      q: "toronto",
      limit: 8,
    });
  });

  it("reads the limit from a query string", () => {
    expect(placesQuerySchemaV1.parse({ q: "toronto", limit: "3" }).limit).toBe(
      3,
    );
  });

  it.each([
    ["a missing query", {}],
    ["a blank query", { q: "   " }],
    ["a limit over the maximum", { q: "toronto", limit: "26" }],
    ["a limit that isn't a number", { q: "toronto", limit: "lots" }],
  ])("rejects %s", (_label, query) => {
    expect(placesQuerySchemaV1.safeParse(query).success).toBe(false);
  });
});

describe("formatValidationError", () => {
  it("names each field without repeating its value", () => {
    const result = chartRequestSchemaV1.safeParse({
      ...VALID_REQUEST,
      date: "1990-13-45",
      latitude: 123.456,
    });
    if (result.success) {
      throw new Error("Expected the request to be rejected.");
    }

    const message = formatValidationError(result.error);

    expect(message).toMatch(/^date: .+; latitude: .+$/);
    expect(message).not.toContain("1990-13-45");
    expect(message).not.toContain("123.456");
  });
});
