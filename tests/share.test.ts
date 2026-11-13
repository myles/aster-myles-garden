import { describe, expect, it } from "vitest";

import { HouseSystem } from "@/lib/houses";
import { buildShareUrl, parseShareHash } from "@/lib/share";

import { CHART } from "./fixtures/chart";

const SITE_URL = "https://aster.myles.garden";

describe("buildShareUrl", () => {
  it("encodes the birth details in the home page's hash", () => {
    expect(buildShareUrl(CHART.details, SITE_URL)).toBe(
      "https://aster.myles.garden/#date=2000-01-01&time=12:00" +
        "&place=2643743&house=equal",
    );
  });

  it("pads dates and times the way form inputs hold them", () => {
    const details = {
      ...CHART.details,
      local: { year: 987, month: 3, day: 4, hour: 5, minute: 6 },
    };

    const { hash } = new URL(buildShareUrl(details, SITE_URL));

    expect(parseShareHash(hash)).toMatchObject({
      date: "0987-03-04",
      time: "05:06",
    });
  });

  it("keeps the details out of the query string", () => {
    const url = new URL(buildShareUrl(CHART.details, SITE_URL));
    expect(url.search).toBe("");
  });
});

describe("parseShareHash", () => {
  it("reads back what buildShareUrl writes", () => {
    const { hash } = new URL(buildShareUrl(CHART.details, SITE_URL));

    expect(parseShareHash(hash)).toEqual({
      date: "2000-01-01",
      time: "12:00",
      placeId: 2643743,
      houseSystem: HouseSystem.Equal,
    });
  });

  it("accepts an encoded colon in the time", () => {
    const shared = parseShareHash("#date=2000-01-01&time=12%3A00&place=1");
    expect(shared?.time).toBe("12:00");
  });

  it("ignores pages opened without a share link", () => {
    expect(parseShareHash("")).toBeUndefined();
    expect(parseShareHash("#top")).toBeUndefined();
  });

  it("falls back to the default house system", () => {
    const shared = parseShareHash("#date=2000-01-01&time=12:00&place=1");
    expect(shared?.houseSystem).toBe(HouseSystem.Placidus);
  });

  it.each([
    ["a missing place", "#date=2000-01-01&time=12:00", "missing"],
    ["a bad date", "#date=yesterday&time=12:00&place=1", "Invalid date"],
    ["a bad time", "#date=2000-01-01&time=noon&place=1", "Invalid time"],
    ["a bad place", "#date=2000-01-01&time=12:00&place=-4", "place"],
    [
      "an unknown house system",
      "#date=2000-01-01&time=12:00&place=1&house=tarot",
      "house system",
    ],
  ])("rejects %s", (_, search, message) => {
    expect(() => parseShareHash(search)).toThrow(message);
  });
});
