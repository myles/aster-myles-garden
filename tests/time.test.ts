import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatDateValue,
  formatTimeValue,
  getLocalTimeZone,
  getOffsetMinutes,
  isTimeZone,
  listTimeZones,
  parseLocalDate,
  parseLocalDateTime,
  parseLocalTime,
  toJulianDay,
  toLocal,
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

describe("parseLocalDate", () => {
  it("parses a date input value", () => {
    expect(parseLocalDate("1990-05-15")).toEqual({
      year: 1990,
      month: 5,
      day: 15,
    });
  });

  it("rejects malformed input", () => {
    expect(() => parseLocalDate("15/05/1990")).toThrow(
      'Invalid date: "15/05/1990"',
    );
  });

  it.each(["2024-02-29", "2000-02-29", "0001-01-01", "2024-12-31"])(
    "accepts the real date %s",
    (date) => {
      expect(() => parseLocalDate(date)).not.toThrow();
    },
  );

  it.each([
    "2024-02-31",
    "2023-02-29",
    "1900-02-29",
    "2024-04-31",
    "2024-01-00",
    "2024-13-01",
    "2024-00-10",
  ])("rejects the impossible date %s", (date) => {
    expect(() => parseLocalDate(date)).toThrow(`Invalid date: "${date}"`);
  });
});

describe("parseLocalTime", () => {
  it("parses a time input value", () => {
    expect(parseLocalTime("09:05")).toEqual({ hour: 9, minute: 5 });
  });

  it("rejects malformed input", () => {
    expect(() => parseLocalTime("2pm")).toThrow('Invalid time: "2pm"');
  });

  it.each(["00:00", "23:59"])("accepts the real time %s", (time) => {
    expect(() => parseLocalTime(time)).not.toThrow();
  });

  it.each(["24:00", "99:99", "12:60"])(
    "rejects the impossible time %s",
    (time) => {
      expect(() => parseLocalTime(time)).toThrow(`Invalid time: "${time}"`);
    },
  );
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

  it.each([
    ["2024-10-27", "02:30", "Europe/Berlin", "2024-10-27T00:30:00.000Z"],
    ["2024-03-31", "02:30", "Europe/Berlin", "2024-03-31T01:30:00.000Z"],
    ["2024-04-07", "01:45", "Australia/Lord_Howe", "2024-04-06T14:45:00.000Z"],
    ["2024-10-06", "02:15", "Australia/Lord_Howe", "2024-10-05T15:45:00.000Z"],
    ["2011-12-30", "12:00", "Pacific/Apia", "2011-12-30T22:00:00.000Z"],
  ])("resolves %s %s in %s consistently", (date, time, zone, expected) => {
    expect(at(date, time, zone)).toBe(expected);
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

describe("toLocal", () => {
  it("reads an instant on a time zone's wall clock", () => {
    expect(
      toLocal(new Date("2026-11-13T20:05:00Z"), "America/Toronto"),
    ).toEqual({
      year: 2026,
      month: 11,
      day: 13,
      hour: 15,
      minute: 5,
    });
  });

  it("crosses midnight when the offset does", () => {
    expect(
      toLocal(new Date("2026-11-13T23:30:00Z"), "Asia/Tokyo"),
    ).toMatchObject({
      day: 14,
      hour: 8,
    });
  });

  it("round-trips with toUtc", () => {
    const at = new Date("1990-05-15T18:30:00Z");
    expect(toUtc(toLocal(at, "America/Toronto"), "America/Toronto")).toEqual(
      at,
    );
  });
});

describe("formatDateValue", () => {
  it("pads as a date input holds it", () => {
    expect(formatDateValue({ year: 987, month: 3, day: 4 })).toBe("0987-03-04");
  });
});

describe("formatTimeValue", () => {
  it("pads as a time input holds it", () => {
    expect(formatTimeValue({ hour: 9, minute: 5 })).toBe("09:05");
  });
});

describe("getLocalTimeZone", () => {
  it("names an IANA time zone", () => {
    expect(
      () => new Intl.DateTimeFormat("en", { timeZone: getLocalTimeZone() }),
    ).not.toThrow();
  });
});

describe("listTimeZones", () => {
  it("lists IANA time zones, sorted, with UTC", () => {
    const zones = listTimeZones();

    expect(zones).toContain("America/Toronto");
    expect(zones).toContain("UTC");
    expect(zones).toEqual([...zones].sort());
  });
});

describe("listTimeZones in a browser that lists UTC", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists UTC once", () => {
    // Node leaves UTC out of its list; some browsers include it, and a
    // duplicate breaks the keyed list of zones in CoordinateFields.
    vi.spyOn(Intl, "supportedValuesOf").mockReturnValue([
      "America/Toronto",
      "UTC",
    ]);

    expect(listTimeZones()).toEqual(["America/Toronto", "UTC"]);
  });
});

describe("isTimeZone", () => {
  it("knows a real zone from a made-up one", () => {
    expect(isTimeZone("Europe/London")).toBe(true);
    expect(isTimeZone("Middle/Earth")).toBe(false);
    expect(isTimeZone("")).toBe(false);
  });
});
