import { afterEach, describe, expect, it, vi } from "vitest";

import { CACHE_NO_STORE } from "@/lib/api/http";
import { transitsRequestSchemaV1, type TransitsV1 } from "@/lib/api/schemas";
import { handleTransitsRequest, readTransitMoment } from "@/lib/api/transits";
import { Ayanamsa } from "@/lib/astrology/ayanamsa";
import { Body } from "@/lib/astrology/bodies";
import * as transitService from "@/lib/charts/transits";
import { parseShareHash } from "@/lib/share";

const TRANSITS_URL = "https://aster.myles.garden/api/v1/transits";

const NATAL = {
  date: "1990-05-15",
  time: "14:30",
  latitude: 43.70643,
  longitude: -79.39864,
  timeZone: "America/Toronto",
};

const AT = "2026-11-18T15:00:00.000Z";

function postTransits(body: unknown): Promise<Response> {
  return handleTransitsRequest(
    new Request(TRANSITS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

async function readTransits(body: unknown): Promise<TransitsV1> {
  return (await (await postTransits(body)).json()) as TransitsV1;
}

function findSunLongitude(transits: TransitsV1): number {
  return transits.bodies.find((body) => body.body === Body.Sun)?.longitude ?? 0;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readTransitMoment", () => {
  it("drops the seconds, as a share link does", () => {
    const at = readTransitMoment(
      transitsRequestSchemaV1.parse({
        natal: NATAL,
        at: "2026-11-18T10:00:42.5-05:00",
      }),
    );

    expect(at.toISOString()).toBe("2026-11-18T15:00:00.000Z");
  });

  it("defaults to now", () => {
    const now = new Date("2026-11-18T15:07:30Z");

    const request = transitsRequestSchemaV1.parse({ natal: NATAL });

    expect(readTransitMoment(request, now).toISOString()).toBe(
      "2026-11-18T15:07:00.000Z",
    );
  });
});

describe("handleTransitsRequest", () => {
  it("sets the sky at a moment against the natal chart", async () => {
    const response = await postTransits({ natal: NATAL, at: AT });
    const transits = (await response.json()) as TransitsV1;

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(CACHE_NO_STORE);
    expect(transits.at).toBe(AT);
    expect(transits.maxOrbDegrees).toBe(2);
    expect(transits.natal.bornAt).toBe("1990-05-15T18:30:00.000Z");
    expect(transits.bodies).toHaveLength(transits.natal.bodies.length);
    expect(transits.bodies.every((body) => body.house !== undefined)).toBe(
      true,
    );
    expect(transits.aspects.length).toBeGreaterThan(0);
    expect(transits.aspects.every((a) => a.orbDegrees <= 2)).toBe(true);
  });

  it("times each transit around the moment shown", async () => {
    const transits = await readTransits({ natal: NATAL, at: AT });
    const at = Date.parse(AT);

    for (const { timing } of transits.aspects) {
      if (timing.entersOrb) {
        expect(Date.parse(timing.entersOrb)).toBeLessThan(at);
      }
      if (timing.leavesOrb) {
        expect(Date.parse(timing.leavesOrb)).toBeGreaterThan(at);
      }
    }
    expect(transits.aspects.some((a) => a.timing.exact.length > 0)).toBe(true);
  });

  it("carries the moment in the share link", async () => {
    const transits = await readTransits({ natal: NATAL, at: AT });
    const shared = parseShareHash(new URL(transits.shareUrl).hash);

    expect(shared?.transitsAt?.toISOString()).toBe(AT);
    expect(shared).toMatchObject({ date: NATAL.date, time: NATAL.time });
  });

  it("follows the natal chart's zodiac", async () => {
    const tropical = await readTransits({ natal: NATAL, at: AT });
    const sidereal = await readTransits({
      natal: { ...NATAL, ayanamsa: Ayanamsa.Lahiri },
      at: AT,
    });

    expect(
      findSunLongitude(tropical) - findSunLongitude(sidereal),
    ).toBeGreaterThan(24);
    expect(
      findSunLongitude(tropical) - findSunLongitude(sidereal),
    ).toBeLessThan(25);
  });

  it("leaves out natal houses without a birth time", async () => {
    const { time: _time, ...withoutTime } = NATAL;
    const transits = await readTransits({ natal: withoutTime, at: AT });

    expect(transits.bodies.every((body) => body.house === undefined)).toBe(
      true,
    );
  });

  it("defaults to now", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(AT) });
    try {
      expect((await readTransits({ natal: NATAL })).at).toBe(AT);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ["a missing natal chart", { at: AT }],
    ["an invalid natal field", { natal: { ...NATAL, latitude: 91 } }],
    ["a moment without an offset", { natal: NATAL, at: "2026-11-18T15:00" }],
    [
      "a moment past the engine's end",
      { natal: NATAL, at: "3500-01-01T00:00Z" },
    ],
    [
      "a birth past the engine's end",
      { natal: { ...NATAL, date: "9999-01-01" } },
    ],
    ["an undeclared field", { natal: NATAL, orb: 5 }],
  ])("answers %s with a 400", async (_label, body) => {
    const response = await postTransits(body);
    const answer = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(answer.error).toEqual(expect.any(String));
  });

  it("names the nested field that's out of range", async () => {
    const response = await postTransits({
      natal: { ...NATAL, date: "9999-01-01" },
    });

    expect(await response.json()).toEqual({
      error: expect.stringMatching(/^natal\.date: /),
    });
  });

  it("never logs birth details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(transitService, "createTransits").mockImplementation(() => {
      throw new RangeError(`jd 2448027.27 for ${NATAL.date} is invalid`);
    });

    const response = await postTransits({ natal: NATAL, at: AT });
    const logged = JSON.stringify(log.mock.calls);

    expect(response.status).toBe(500);
    expect(logged).toContain("RangeError");
    for (const detail of [NATAL.date, "2448027", "43.70", "-79.39"]) {
      expect(logged).not.toContain(detail);
    }
  });
});
