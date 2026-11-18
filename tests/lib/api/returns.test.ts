import { afterEach, describe, expect, it, vi } from "vitest";

import { LUNAR_RETURN_PATH, SOLAR_RETURN_PATH } from "@/lib/api/paths";
import {
  handleLunarReturnRequest,
  handleSolarReturnRequest,
} from "@/lib/api/returns";
import { type LunarReturnV1, type SolarReturnV1 } from "@/lib/api/schemas";
import { Body } from "@/lib/astrology/bodies";
import { parseShareHash } from "@/lib/share";

import { NATAL, postJson } from "./post";

const LONDON = {
  latitude: 51.5085,
  longitude: -0.1257,
  timeZone: "Europe/London",
  placeName: "London",
};

const postSolarReturn = (body: unknown) =>
  postJson<SolarReturnV1>(handleSolarReturnRequest, SOLAR_RETURN_PATH, body);

const postLunarReturn = (body: unknown) =>
  postJson<LunarReturnV1>(handleLunarReturnRequest, LUNAR_RETURN_PATH, body);

function findLongitude(chart: SolarReturnV1["chart"], body: Body): number {
  return chart.bodies.find((placed) => placed.body === body)?.longitude ?? 0;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("handleSolarReturnRequest", () => {
  it("finds the moment the Sun returns, cast at the birthplace", async () => {
    const { status, data } = await postSolarReturn({
      natal: NATAL,
      year: 2026,
    });

    expect(status).toBe(200);
    expect(data.year).toBe(2026);
    expect(data.chart.bornAt.startsWith("2026-05-15")).toBe(true);
    expect(findLongitude(data.chart, Body.Sun)).toBeCloseTo(
      findLongitude(data.natal, Body.Sun),
      5,
    );
    expect(data.chart.houses).toBeDefined();
  });

  it("casts the return where it's asked for, and links to it", async () => {
    const { data } = await postSolarReturn({
      natal: NATAL,
      year: 2026,
      place: LONDON,
    });
    const shared = parseShareHash(new URL(data.shareUrl).hash);

    expect(shared?.solarReturn).toMatchObject({
      year: 2026,
      place: { place: { name: "London", timeZone: "Europe/London" } },
    });
  });

  it("defaults to the return in effect now", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-03-01T00:00Z") });

    expect((await postSolarReturn({ natal: NATAL })).data.year).toBe(2025);
  });

  it.each([
    ["no birth time", { natal: { ...NATAL, time: undefined }, year: 2026 }],
    ["a year before the birth", { natal: NATAL, year: 1980 }],
    ["a year the engine can't reach", { natal: NATAL, year: 3500 }],
  ])("answers %s with a 400", async (_label, body) => {
    const { status, data } = await postSolarReturn(body);

    expect(status).toBe(400);
    expect(data).toEqual({ error: expect.any(String) });
  });
});

describe("handleLunarReturnRequest", () => {
  it("finds the latest return by the end of the date", async () => {
    const { status, data } = await postLunarReturn({
      natal: NATAL,
      date: "2026-11-18",
    });
    const returnedAt = Date.parse(data.chart.bornAt);

    expect(status).toBe(200);
    expect(returnedAt).toBeLessThan(Date.parse("2026-11-19T05:00Z"));
    expect(returnedAt).toBeGreaterThan(Date.parse("2026-10-21T00:00Z"));
    expect(findLongitude(data.chart, Body.Moon)).toBeCloseTo(
      findLongitude(data.natal, Body.Moon),
      4,
    );
  });

  it("links to the return", async () => {
    const { data } = await postLunarReturn({
      natal: NATAL,
      date: "2026-11-18",
      place: LONDON,
    });

    expect(parseShareHash(new URL(data.shareUrl).hash)?.lunarReturn).toEqual(
      expect.objectContaining({ date: { year: 2026, month: 11, day: 18 } }),
    );
  });

  it("defaults to today where it's cast", async () => {
    // Already the 19th in London, still the 18th in Toronto.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-19T02:00Z") });
    const atBirthplace = await postLunarReturn({ natal: NATAL });
    const inLondon = await postLunarReturn({ natal: NATAL, place: LONDON });

    expect(
      parseShareHash(new URL(atBirthplace.data.shareUrl).hash)?.lunarReturn
        ?.date,
    ).toEqual({ year: 2026, month: 11, day: 18 });
    expect(
      parseShareHash(new URL(inLondon.data.shareUrl).hash)?.lunarReturn?.date,
    ).toEqual({ year: 2026, month: 11, day: 19 });
  });

  it.each([
    ["no birth time", { natal: { ...NATAL, time: undefined } }],
    ["a date before the first return", { natal: NATAL, date: "1990-05-20" }],
  ])("answers %s with a 400", async (_label, body) => {
    expect((await postLunarReturn(body)).status).toBe(400);
  });
});
