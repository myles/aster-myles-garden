import { describe, expect, it } from "vitest";

import { AspectSet, DEFAULT_ASPECT_SETTINGS, OrbSize } from "@/lib/aspects";
import { HouseSystem } from "@/lib/houses";
import { buildShareUrl, parseShareHash } from "@/lib/share";

import { CHART, CHART_WITHOUT_TIME } from "./fixtures/chart";

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
      date: { year: 987, month: 3, day: 4 },
      time: { hour: 5, minute: 6 },
    };

    const { hash } = new URL(buildShareUrl(details, SITE_URL));

    expect(parseShareHash(hash)).toMatchObject({
      date: "0987-03-04",
      time: "05:06",
    });
  });

  it("says when the birth time is unknown", () => {
    const url = buildShareUrl(CHART_WITHOUT_TIME.details, SITE_URL);
    expect(url).toContain("&time=unknown&");
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
      aspectSettings: DEFAULT_ASPECT_SETTINGS,
    });
  });

  it("reads an unknown birth time", () => {
    const shared = parseShareHash("#date=2000-01-01&time=unknown&place=1");
    expect(shared).toMatchObject({ date: "2000-01-01", time: undefined });
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
    [
      "an impossible date and time",
      "#date=2024-02-31&time=99:99&place=1",
      "Invalid date",
    ],
    [
      "an impossible time",
      "#date=2000-01-01&time=24:00&place=1",
      "Invalid time",
    ],
    [
      "an impossible transit date",
      "#date=2000-01-01&time=12:00&place=1&transits=2024-02-31T12:00Z",
      "transit moment",
    ],
    [
      "an impossible transit time",
      "#date=2000-01-01&time=12:00&place=1&transits=2026-11-13T24:00Z",
      "transit moment",
    ],
    ["a bad place", "#date=2000-01-01&time=12:00&place=-4", "place"],
    [
      "an unknown house system",
      "#date=2000-01-01&time=12:00&place=1&house=tarot",
      "house system",
    ],
    [
      "an unknown aspect set",
      "#date=2000-01-01&time=12:00&place=1&aspects=some",
      "aspects",
    ],
    [
      "an unknown orb size",
      "#date=2000-01-01&time=12:00&place=1&orbs=huge",
      "orbs",
    ],
  ])("rejects %s", (_, search, message) => {
    expect(() => parseShareHash(search)).toThrow(message);
  });
});

describe("share links with aspect settings", () => {
  const SETTINGS = { aspectSet: AspectSet.All, orbSize: OrbSize.Wide };

  it("leaves the default settings out", () => {
    expect(buildShareUrl(CHART.details, SITE_URL)).not.toMatch(/aspects|orbs/);
  });

  it("adds settings other than the default", () => {
    const details = { ...CHART.details, aspectSettings: SETTINGS };

    expect(buildShareUrl(details, SITE_URL)).toBe(
      "https://aster.myles.garden/#date=2000-01-01&time=12:00" +
        "&place=2643743&house=equal&aspects=all&orbs=wide",
    );
  });

  it("reads them back", () => {
    const details = { ...CHART.details, aspectSettings: SETTINGS };
    const { hash } = new URL(buildShareUrl(details, SITE_URL));

    expect(parseShareHash(hash)?.aspectSettings).toEqual(SETTINGS);
  });

  it("falls back to the default for either one left out", () => {
    const shared = parseShareHash(
      "#date=2000-01-01&time=12:00&place=1&orbs=tight",
    );

    expect(shared?.aspectSettings).toEqual({
      aspectSet: AspectSet.Major,
      orbSize: OrbSize.Tight,
    });
  });
});

describe("share links for a comparison", () => {
  const THEIRS = {
    ...CHART_WITHOUT_TIME.details,
    date: { year: 1990, month: 5, day: 15 },
  };

  it("adds the second chart's date, time and place", () => {
    const url = buildShareUrl(CHART.details, SITE_URL, {
      comparedWith: THEIRS,
    });

    expect(url).toBe(
      "https://aster.myles.garden/#date=2000-01-01&time=12:00" +
        "&place=2643743&house=equal" +
        "&date2=1990-05-15&time2=unknown&place2=2643743",
    );
  });

  it("reads both charts back", () => {
    const { hash } = new URL(
      buildShareUrl(CHART.details, SITE_URL, { comparedWith: THEIRS }),
    );

    expect(parseShareHash(hash)).toEqual({
      date: "2000-01-01",
      time: "12:00",
      placeId: 2643743,
      houseSystem: HouseSystem.Equal,
      aspectSettings: DEFAULT_ASPECT_SETTINGS,
      comparedWith: { date: "1990-05-15", time: undefined, placeId: 2643743 },
    });
  });

  it("has no second chart in a single chart's link", () => {
    const shared = parseShareHash("#date=2000-01-01&time=12:00&place=1");
    expect(shared?.comparedWith).toBeUndefined();
  });

  it.each([
    [
      "a second chart missing its place",
      "#date=2000-01-01&time=12:00&place=1&date2=1990-05-15&time2=12:00",
      "second chart is missing",
    ],
    [
      "a second chart with a bad place",
      "#date=2000-01-01&time=12:00&place=1" +
        "&date2=1990-05-15&time2=12:00&place2=x",
      "second chart's place",
    ],
  ])("rejects %s", (_, hash, message) => {
    expect(() => parseShareHash(hash)).toThrow(message);
  });
});

describe("share links for transits", () => {
  const AT = new Date("2026-11-13T20:05:00Z");

  it("adds the moment, in UTC to the minute", () => {
    const url = buildShareUrl(CHART.details, SITE_URL, { transitsAt: AT });

    expect(url).toBe(
      "https://aster.myles.garden/#date=2000-01-01&time=12:00" +
        "&place=2643743&house=equal&transits=2026-11-13T20:05Z",
    );
  });

  it("reads the moment back", () => {
    const { hash } = new URL(
      buildShareUrl(CHART.details, SITE_URL, { transitsAt: AT }),
    );

    expect(parseShareHash(hash)?.transitsAt).toEqual(AT);
  });

  it.each([
    ["a malformed moment", "&transits=tomorrow", "transit moment"],
    [
      "both transits and a second chart",
      "&transits=2026-11-13T20:05Z" + "&date2=1990-05-15&time2=12:00&place2=1",
      "both",
    ],
  ])("rejects %s", (_, extra, message) => {
    const hash = "#date=2000-01-01&time=12:00&place=1" + extra;
    expect(() => parseShareHash(hash)).toThrow(message);
  });
});

describe("share links for a place entered by coordinates", () => {
  const SMALLVILLE = {
    name: "Smallville",
    region: "",
    country: "",
    latitude: 43.7,
    longitude: -79.4,
    timeZone: "America/Toronto",
  };
  const details = { ...CHART.details, place: SMALLVILLE };

  it("carries the coordinates, time zone and name", () => {
    expect(buildShareUrl(details, SITE_URL)).toBe(
      "https://aster.myles.garden/#date=2000-01-01&time=12:00" +
        "&lat=43.7&lon=-79.4&tz=America/Toronto&name=Smallville&house=equal",
    );
  });

  it("leaves out a name that's only the coordinates", () => {
    const unnamed = {
      ...details,
      place: { ...SMALLVILLE, name: "43.70° N, 79.40° W" },
    };

    expect(buildShareUrl(unnamed, SITE_URL)).not.toContain("name=");
  });

  it("reads the place back", () => {
    const { hash } = new URL(buildShareUrl(details, SITE_URL));

    expect(parseShareHash(hash)).toMatchObject({
      date: "2000-01-01",
      place: SMALLVILLE,
    });
  });

  it("names an unnamed place by its coordinates when read back", () => {
    const shared = parseShareHash(
      "#date=2000-01-01&time=12:00&lat=43.7&lon=-79.4&tz=America/Toronto",
    );

    expect(shared).toMatchObject({ place: { name: "43.70° N, 79.40° W" } });
  });

  it("works for the second person too", () => {
    const { hash } = new URL(
      buildShareUrl(CHART.details, SITE_URL, { comparedWith: details }),
    );

    expect(hash).toContain("&lat2=43.7&lon2=-79.4&tz2=America/Toronto");
    expect(parseShareHash(hash)?.comparedWith).toMatchObject({
      place: SMALLVILLE,
    });
  });

  it.each([
    ["a missing time zone", "&lat=43.7&lon=-79.4", "missing"],
    [
      "an unknown time zone",
      "&lat=43.7&lon=-79.4&tz=Middle/Earth",
      "time zone",
    ],
    ["a latitude out of range", "&lat=95&lon=-79.4&tz=UTC", "Latitude"],
  ])("rejects %s", (_, place, message) => {
    const hash = "#date=2000-01-01&time=12:00" + place;
    expect(() => parseShareHash(hash)).toThrow(message);
  });
});
