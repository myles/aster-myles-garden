import { describe, expect, it } from "vitest";

import {
  getOffsetMinutes,
  parseLocalDateTime,
  toJulianDay,
  toUtc,
} from "@/lib/time";

describe("parseLocalDateTime", () => {
  it("parses date and time input values", () => {
    expect(parseLocalDateTime("1990-05-15", "14:30")).toEqual({
      year: 1990,
      month: 5,
      day: 15,
      hour: 14,
      minute: 30,
    });
  });

  it("rejects malformed input", () => {
    expect(() => parseLocalDateTime("15/05/1990", "14:30")).toThrow();
    expect(() => parseLocalDateTime("1990-05-15", "2pm")).toThrow();
  });
});

describe("toUtc", () => {
  const at = (date: string, time: string, zone: string) =>
    toUtc(parseLocalDateTime(date, time), zone).toISOString();

  it("applies daylight saving time", () => {
    expect(at("1990-05-15", "14:30", "America/Toronto")).toBe(
      "1990-05-15T18:30:00.000Z",
    );
    expect(at("1990-01-15", "14:30", "America/Toronto")).toBe(
      "1990-01-15T19:30:00.000Z",
    );
  });

  it("uses historical rules, not today's", () => {
    // Britain stayed on GMT+1 all year from 1968 to 1971.
    expect(at("1970-01-15", "12:00", "Europe/London")).toBe(
      "1970-01-15T11:00:00.000Z",
    );
  });

  it("handles Local Mean Time offsets with seconds", () => {
    // Toronto kept LMT (−5:17:32) until 1895.
    expect(at("1880-01-01", "12:00", "America/Toronto")).toBe(
      "1880-01-01T17:17:32.000Z",
    );
  });

  it("picks the earlier instant when clocks fall back", () => {
    expect(at("2024-11-03", "01:30", "America/Toronto")).toBe(
      "2024-11-03T05:30:00.000Z",
    );
  });

  it("moves a skipped time past a spring-forward gap", () => {
    expect(at("2024-03-10", "02:30", "America/Toronto")).toBe(
      "2024-03-10T07:30:00.000Z",
    );
  });

  it("handles zones east of UTC across midnight", () => {
    expect(at("2000-01-01", "05:00", "Asia/Tokyo")).toBe(
      "1999-12-31T20:00:00.000Z",
    );
  });
});

describe("getOffsetMinutes", () => {
  it("returns the zone offset at an instant", () => {
    const instant = new Date("2024-07-01T12:00:00Z");
    expect(getOffsetMinutes("America/Toronto", instant)).toBe(-240);
    expect(getOffsetMinutes("Asia/Kolkata", instant)).toBe(330);
  });
});

describe("toJulianDay", () => {
  it("matches the J2000.0 epoch", () => {
    expect(toJulianDay(new Date("2000-01-01T12:00:00Z"))).toBe(2_451_545);
  });

  it("matches the Unix epoch", () => {
    expect(toJulianDay(new Date(0))).toBe(2_440_587.5);
  });
});
