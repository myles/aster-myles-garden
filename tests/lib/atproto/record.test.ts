import { describe, expect, it } from "vitest";

import { HouseSystem } from "@/lib/astrology/houses";
import {
  buildChartRecord,
  parseChartRecord,
  TimeDisclosure,
} from "@/lib/atproto/record";

import { CHART } from "../../fixtures/chart";

const UPDATED_AT = new Date("2026-11-13T12:00:00Z");
const RECORD = buildChartRecord(
  CHART.details,
  TimeDisclosure.Include,
  UPDATED_AT,
);

describe("chart records", () => {
  it("stores a datetime and a community geo object", () => {
    expect(RECORD).toMatchObject({
      bornAt: "2000-01-01T12:00:00.000Z",
      isBirthTimeKnown: true,
      location: { latitude: "51.5", longitude: "-0.12", name: "London" },
    });
    expect(RECORD).not.toHaveProperty("birthDate");
    expect(RECORD).not.toHaveProperty("birthTime");
    expect(parseChartRecord(RECORD)).toEqual({
      ...CHART.details,
      place: { ...CHART.details.place, id: undefined, region: "", country: "" },
    });
  });
  it("names whose chart it is only when given a name", () => {
    expect(RECORD).not.toHaveProperty("name");
    expect(parseChartRecord(RECORD)).not.toHaveProperty("name");

    const named = buildChartRecord(
      { ...CHART.details, name: "Mum" },
      TimeDisclosure.Include,
      UPDATED_AT,
    );
    expect(named.name).toBe("Mum");
    expect(parseChartRecord(named).name).toBe("Mum");
  });
  it("rejects a name longer than the lexicon allows", () => {
    expect(() =>
      buildChartRecord(
        { ...CHART.details, name: "a".repeat(65) },
        TimeDisclosure.Include,
        UPDATED_AT,
      ),
    ).toThrow();
  });
  it("omits the actual time and uses local noon when withheld", () => {
    const details = {
      ...CHART.details,
      time: { hour: 3, minute: 17 },
      place: { ...CHART.details.place, timeZone: "Asia/Tokyo" },
    };
    const record = buildChartRecord(details, TimeDisclosure.Omit, UPDATED_AT);
    expect(record.bornAt).toBe("2000-01-01T03:00:00.000Z");
    expect(record.isBirthTimeKnown).toBe(false);
    expect(parseChartRecord(record).time).toBeUndefined();
    expect(parseChartRecord(record).date).toEqual(details.date);
  });
  it("keeps an unknown birth time unknown", () => {
    const record = buildChartRecord(
      { ...CHART.details, time: undefined },
      TimeDisclosure.Include,
      UPDATED_AT,
    );
    expect(record.isBirthTimeKnown).toBe(false);
    expect(parseChartRecord(record).time).toBeUndefined();
  });
  it("preserves optional AI preferences without inventing defaults", () => {
    const aiPreferences = {
      training: { allow: false, updatedAt: UPDATED_AT.toISOString() },
      inference: { allow: true, updatedAt: UPDATED_AT.toISOString() },
    };
    const record = buildChartRecord(
      { ...CHART.details, aiPreferences },
      TimeDisclosure.Include,
      UPDATED_AT,
    );
    expect(parseChartRecord(record).aiPreferences).toEqual(aiPreferences);
    expect(RECORD).not.toHaveProperty("aiPreferences");
  });
  it.each([
    ["2024-10-27", "02:30", "Europe/Berlin", "2024-10-27T00:30:00.000Z"],
    ["1880-01-01", "12:00", "America/Toronto", "1880-01-01T17:17:32.000Z"],
  ])("round-trips %s %s in %s", (date, time, zone, expected) => {
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    const details = {
      ...CHART.details,
      date: { year, month, day },
      time: { hour, minute },
      place: { ...CHART.details.place, timeZone: zone },
    };
    const record = buildChartRecord(
      details,
      TimeDisclosure.Include,
      UPDATED_AT,
    );
    expect(record.bornAt).toBe(expected);
    expect(parseChartRecord(record)).toMatchObject({
      date: details.date,
      time: details.time,
    });
  });
  it("rejects a skipped calendar date instead of saving another day", () => {
    expect(() =>
      buildChartRecord(
        {
          ...CHART.details,
          date: { year: 2011, month: 12, day: 30 },
          time: undefined,
          place: { ...CHART.details.place, timeZone: "Pacific/Apia" },
        },
        TimeDisclosure.Omit,
        UPDATED_AT,
      ),
    ).toThrow();
  });
  it.each([
    null,
    { ...RECORD, bornAt: "2024" },
    { ...RECORD, isBirthTimeKnown: "false" },
    { ...RECORD, location: { latitude: "91", longitude: "0" } },
    { ...RECORD, timeZone: "invalid" },
    { ...RECORD, houseSystem: "invalid" },
    { ...RECORD, updatedAt: "2026" },
    { ...RECORD, location: { ...RECORD.location, name: "é".repeat(101) } },
    {
      ...RECORD,
      aiPreferences: { training: { allow: "yes", updatedAt: "2026" } },
    },
    { ...RECORD, isBirthTimeKnown: false, bornAt: "2000-01-01T01:30:00Z" },
  ])("rejects malformed records: %j", (record) => {
    expect(() => parseChartRecord(record)).toThrow();
  });
  it.each([
    { ...CHART.details, date: { year: 2024, month: 2, day: 31 } },
    { ...CHART.details, time: { hour: 24, minute: 0 } },
    { ...CHART.details, houseSystem: "bad" as HouseSystem },
  ])("rejects invalid outbound details", (details) => {
    expect(() =>
      buildChartRecord(details, TimeDisclosure.Include, UPDATED_AT),
    ).toThrow();
  });
});
