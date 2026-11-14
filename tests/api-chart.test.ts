import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatChartForApi,
  handleChartRequest,
  isInEngineRange,
  toBirthDetails,
} from "@/lib/api/chart";
import { CACHE_NO_STORE } from "@/lib/api/http";
import { chartRequestSchemaV1, type ChartV1 } from "@/lib/api/schemas";
import { Body } from "@/lib/bodies";
import * as chartService from "@/lib/chart";
import { HouseSystem } from "@/lib/houses";
import { parseShareHash } from "@/lib/share";

import { CHART } from "./fixtures/chart";

const CHART_URL = "https://aster.myles.garden/api/v1/chart";

const BIRTH = {
  date: "1990-05-15",
  time: "14:30",
  latitude: 43.70643,
  longitude: -79.39864,
  timeZone: "America/Toronto",
  placeName: "Toronto",
};

const TROMSO_BIRTH = {
  date: "2000-01-01",
  time: "12:00",
  latitude: 69.65,
  longitude: 18.96,
  timeZone: "Europe/Oslo",
};

function postChart(body: unknown): Promise<Response> {
  return handleChartRequest(
    new Request(CHART_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

function detailsFor(date: string) {
  return toBirthDetails(chartRequestSchemaV1.parse({ ...BIRTH, date }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("toBirthDetails", () => {
  it("rounds coordinates as a share link does", () => {
    const details = toBirthDetails(chartRequestSchemaV1.parse(BIRTH));

    expect(details.place).toMatchObject({
      name: "Toronto",
      latitude: 43.7064,
      longitude: -79.3986,
      timeZone: "America/Toronto",
    });
    expect(details.time).toEqual({ hour: 14, minute: 30 });
  });

  it("leaves the time out when it isn't known", () => {
    const { time: _time, ...withoutTime } = BIRTH;
    const details = toBirthDetails(chartRequestSchemaV1.parse(withoutTime));

    expect(details.time).toBeUndefined();
  });
});

describe("isInEngineRange", () => {
  it("accepts dates the engine covers", () => {
    expect(isInEngineRange(detailsFor("0001-01-01"))).toBe(true);
    expect(isInEngineRange(detailsFor("2999-06-01"))).toBe(true);
  });

  it("rejects dates past its end", () => {
    expect(isInEngineRange(detailsFor("3004-01-01"))).toBe(false);
  });
});

describe("formatChartForApi", () => {
  it("formats a chart", () => {
    const formatted = formatChartForApi(CHART);

    expect(formatted.bornAt).toBe("2000-01-01T12:00:00.000Z");
    expect(formatted.isTimeKnown).toBe(true);
    expect(formatted.houseSystem).toBe(HouseSystem.Equal);
    expect(formatted.effectiveHouseSystem).toBe(HouseSystem.Equal);
    expect(formatted.bodies[0]).toEqual({
      body: Body.Sun,
      name: "Sun",
      longitude: 280,
      latitude: 0,
      speed: 1,
      sign: "Capricorn",
      label: "10° 00′ Capricorn",
      isRetrograde: false,
      house: 10,
    });
    expect(formatted.houses?.cusps[0]).toMatchObject({ house: 1 });
    expect(formatted.aspects[0]).toMatchObject({
      type: "opposition",
      quality: "challenging",
    });
  });
});

describe("handleChartRequest", () => {
  it("calculates a chart that its share link reopens", async () => {
    const response = await postChart(BIRTH);
    const chart = (await response.json()) as ChartV1;

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(CACHE_NO_STORE);
    expect(chart.bornAt).toBe("1990-05-15T18:30:00.000Z");
    expect(chart.bodies.find((body) => body.body === Body.Sun)?.label).toBe(
      "24° 39′ Taurus",
    );
    expect(chart.houses?.ascendant.label).toBe("15° 38′ Virgo");

    const shared = parseShareHash(new URL(chart.shareUrl).hash);
    expect(shared).toMatchObject({
      date: BIRTH.date,
      time: BIRTH.time,
      houseSystem: HouseSystem.Placidus,
      place: { latitude: 43.7064, longitude: -79.3986, name: "Toronto" },
    });
  });

  it("names the house system it used", async () => {
    const chart = (await (await postChart(BIRTH)).json()) as ChartV1;

    expect(chart.houseSystem).toBe(HouseSystem.Placidus);
    expect(chart.effectiveHouseSystem).toBe(HouseSystem.Placidus);
  });

  it.each([HouseSystem.Placidus, HouseSystem.Koch])(
    "falls back from %s to Porphyry inside the Arctic Circle",
    async (houseSystem) => {
      const response = await postChart({ ...TROMSO_BIRTH, houseSystem });
      const chart = (await response.json()) as ChartV1;

      expect(response.status).toBe(200);
      expect(chart.houseSystem).toBe(houseSystem);
      expect(chart.effectiveHouseSystem).toBe(HouseSystem.Porphyry);
      expect(chart.houses?.cusps).toHaveLength(12);
    },
  );

  it("leaves out houses without a birth time", async () => {
    const { time: _time, ...withoutTime } = BIRTH;
    const chart = (await (await postChart(withoutTime)).json()) as ChartV1;

    expect(chart.isTimeKnown).toBe(false);
    expect(chart.houses).toBeUndefined();
    expect(chart.effectiveHouseSystem).toBeUndefined();
    expect(chart.bodies.every((body) => body.house === undefined)).toBe(true);
    expect(chart.bodies.every((body) => body.possibleSigns)).toBe(true);
  });

  it.each([
    ["a body that isn't JSON", "date=1990-05-15"],
    ["an invalid field", { ...BIRTH, latitude: 91 }],
    ["a date outside the engine's range", { ...BIRTH, date: "9999-01-01" }],
  ])("answers %s with a 400", async (_label, body) => {
    const response = await postChart(body);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String) });
  });

  it("never logs birth details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(chartService, "createChart").mockImplementation(() => {
      throw new RangeError(`jd 2448027.27 for ${BIRTH.date} is invalid`);
    });

    const response = await postChart(BIRTH);
    const logged = JSON.stringify(log.mock.calls);

    expect(response.status).toBe(500);
    expect(log).toHaveBeenCalledOnce();
    expect(logged).toContain("RangeError");
    for (const detail of [BIRTH.date, "2448027", "43.70", "-79.39"]) {
      expect(logged).not.toContain(detail);
    }
  });
});
