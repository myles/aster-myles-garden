import { describe, expect, it } from "vitest";

import {
  handleCompositeRequest,
  handleSynastryRequest,
} from "@/lib/api/comparison";
import { COMPOSITE_PATH, SYNASTRY_PATH } from "@/lib/api/paths";
import { type CompositeV1, type SynastryV1 } from "@/lib/api/schemas";
import { AspectSet } from "@/lib/astrology/aspects";
import { Ayanamsa } from "@/lib/astrology/ayanamsa";
import { HouseSystem } from "@/lib/astrology/houses";
import { ComparisonStyle } from "@/lib/charts/synastry";
import { parseShareHash } from "@/lib/share";

import { NATAL, postJson } from "./post";

const SECOND = {
  date: "1992-09-03",
  time: "06:15",
  latitude: 49.2827,
  longitude: -123.1207,
  timeZone: "America/Vancouver",
};

const BOTH = { first: NATAL, second: SECOND };

const postSynastry = (body: unknown) =>
  postJson<SynastryV1>(handleSynastryRequest, SYNASTRY_PATH, body);

const postComposite = (body: unknown) =>
  postJson<CompositeV1>(handleCompositeRequest, COMPOSITE_PATH, body);

describe("handleSynastryRequest", () => {
  it("compares two charts, both ways", async () => {
    const { status, data } = await postSynastry(BOTH);

    expect(status).toBe(200);
    expect(data.first.bornAt).toBe("1990-05-15T18:30:00.000Z");
    expect(data.second.bornAt).toBe("1992-09-03T13:15:00.000Z");
    expect(data.aspects.length).toBeGreaterThan(0);
    expect(data.secondInFirstHouses).toHaveLength(data.second.bodies.length);
    expect(data.firstInSecondHouses).toHaveLength(data.first.bodies.length);
  });

  it("casts the second chart with the first's settings", async () => {
    const first = {
      ...NATAL,
      houseSystem: HouseSystem.WholeSign,
      aspectSet: AspectSet.All,
      ayanamsa: Ayanamsa.Lahiri,
    };
    const { data } = await postSynastry({ first, second: SECOND });

    expect(data.second).toMatchObject({
      houseSystem: HouseSystem.WholeSign,
      aspectSet: AspectSet.All,
      ayanamsa: Ayanamsa.Lahiri,
    });
  });

  it("leaves out the overlay into a chart without houses", async () => {
    const { time: _time, ...withoutTime } = SECOND;
    const { data } = await postSynastry({ first: NATAL, second: withoutTime });

    expect(data.secondInFirstHouses).toBeDefined();
    expect(data.firstInSecondHouses).toBeUndefined();
  });

  it("links to the bi-wheel", async () => {
    const { data } = await postSynastry(BOTH);
    const shared = parseShareHash(new URL(data.shareUrl).hash);

    expect(shared?.comparedWith).toMatchObject({
      date: SECOND.date,
      time: SECOND.time,
    });
    expect(shared?.comparisonStyle).toBeUndefined();
  });

  it.each([
    ["a missing second person", { first: NATAL }],
    [
      "settings on the second person",
      { ...BOTH, second: { ...SECOND, houseSystem: "koch" } },
    ],
  ])("answers %s with a 400", async (_label, body) => {
    expect((await postSynastry(body)).status).toBe(400);
  });

  it("names the second chart's date when it's out of range", async () => {
    const { status, data } = await postSynastry({
      first: NATAL,
      second: { ...SECOND, date: "9999-01-01" },
    });

    expect(status).toBe(400);
    expect(data).toEqual({ error: expect.stringMatching(/^second\.date: /) });
  });
});

describe("handleCompositeRequest", () => {
  it("makes one chart from the midpoints of two", async () => {
    const { status, data } = await postComposite(BOTH);

    expect(status).toBe(200);
    expect(data.bodies).toHaveLength(data.first.bodies.length);
    expect(data.bodies.every((body) => body.speed === 0)).toBe(true);
    expect(data.houses?.cusps).toHaveLength(12);
    expect(data.effectiveHouseSystem).toBe(HouseSystem.Placidus);
  });

  it("has no houses when a birth time is missing", async () => {
    const { time: _time, ...withoutTime } = SECOND;
    const { status, data } = await postComposite({
      first: NATAL,
      second: withoutTime,
    });

    expect(status).toBe(200);
    expect(data.houses).toBeUndefined();
    expect(data.effectiveHouseSystem).toBeUndefined();
  });

  it("links to the composite", async () => {
    const { data } = await postComposite(BOTH);

    expect(parseShareHash(new URL(data.shareUrl).hash)?.comparisonStyle).toBe(
      ComparisonStyle.Composite,
    );
  });
});
