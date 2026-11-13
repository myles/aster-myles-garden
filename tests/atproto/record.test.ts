import { describe, expect, it } from "vitest";

import {
  buildChartRecord,
  parseChartRecord,
  TimeDisclosure,
} from "@/experimental/atproto/record";

import { CHART } from "../fixtures/chart";

const UPDATED_AT = new Date("2026-11-13T12:00:00Z");
const RECORD = buildChartRecord(
  CHART.details,
  TimeDisclosure.Include,
  UPDATED_AT,
);

describe("chart records", () => {
  it("round-trips calculation inputs without computed chart data", () => {
    const details = parseChartRecord(RECORD);
    expect(details).toEqual({
      ...CHART.details,
      place: { ...CHART.details.place, id: undefined, region: "", country: "" },
    });
    expect(RECORD.updatedAt).toBe(UPDATED_AT.toISOString());
    expect(RECORD).not.toHaveProperty("bodies");
    expect(RECORD).not.toHaveProperty("bornAt");
  });
  it("omits time entirely when requested", () => {
    const record = buildChartRecord(
      CHART.details,
      TimeDisclosure.Omit,
      UPDATED_AT,
    );
    expect(record).not.toHaveProperty("birthTime");
    expect(parseChartRecord(record).time).toBeUndefined();
  });
  it("preserves an unknown time", () => {
    expect(
      buildChartRecord(
        { ...CHART.details, time: undefined },
        TimeDisclosure.Include,
        UPDATED_AT,
      ),
    ).not.toHaveProperty("birthTime");
  });
  it.each([
    null,
    { ...RECORD, $type: "wrong" },
    { ...RECORD, birthDate: "2024-02-31" },
    { ...RECORD, birthDate: "0000-01-01" },
    { ...RECORD, birthDate: "not a date" },
    { ...RECORD, birthTime: "24:00" },
    { ...RECORD, birthTime: "12:60" },
    { ...RECORD, birthTime: 12 },
    { ...RECORD, coordinates: "91, 0" },
    { ...RECORD, coordinates: "0, Infinity" },
    { ...RECORD, timeZone: "not/a/zone" },
    { ...RECORD, houseSystem: "unknown" },
    { ...RECORD, updatedAt: "yesterday" },
    { ...RECORD, updatedAt: "2026" },
    { ...RECORD, placeName: "é".repeat(101) },
  ])("rejects invalid remote records: %j", (record) => {
    expect(() => parseChartRecord(record)).toThrow();
  });
  it("rejects invalid outbound values too", () => {
    expect(() =>
      buildChartRecord(
        {
          ...CHART.details,
          date: { year: 2024, month: 2, day: 31 },
        },
        TimeDisclosure.Omit,
        UPDATED_AT,
      ),
    ).toThrow();
  });
});
