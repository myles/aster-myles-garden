import { afterEach, describe, expect, it, vi } from "vitest";

import { PROGRESSIONS_PATH } from "@/lib/api/paths";
import { handleProgressionsRequest } from "@/lib/api/progressions";
import { type ProgressionsV1 } from "@/lib/api/schemas";
import { parseShareHash } from "@/lib/share";

import { NATAL, postJson } from "./post";

const postProgressions = (body: unknown) =>
  postJson<ProgressionsV1>(handleProgressionsRequest, PROGRESSIONS_PATH, body);

afterEach(() => {
  vi.useRealTimers();
});

describe("handleProgressionsRequest", () => {
  it("moves the chart on a day for each year of life", async () => {
    const { status, data } = await postProgressions({
      natal: NATAL,
      date: "2020-05-15",
    });
    const daysOn =
      (Date.parse(data.skyAt) - Date.parse(data.natal.bornAt)) / 86_400_000;

    expect(status).toBe(200);
    expect(data.date).toBe("2020-05-15");
    // Thirty years lived: thirty days of sky.
    expect(daysOn).toBeCloseTo(30, 1);
    expect(data.maxOrbDegrees).toBe(1);
    expect(data.bodies.every((body) => body.house !== undefined)).toBe(true);
    expect(data.aspects.every((a) => a.orbDegrees <= 1)).toBe(true);
  });

  it("links to the progressions", async () => {
    const { data } = await postProgressions({
      natal: NATAL,
      date: "2020-05-15",
    });
    const shared = parseShareHash(new URL(data.shareUrl).hash);

    expect(shared?.progressionsForDate).toEqual({
      year: 2020,
      month: 5,
      day: 15,
    });
  });

  it("defaults to today in UTC", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-18T23:30Z") });

    expect((await postProgressions({ natal: NATAL })).data.date).toBe(
      "2026-11-18",
    );
  });

  it("answers a date before the birth with a 400", async () => {
    const { status, data } = await postProgressions({
      natal: NATAL,
      date: "1980-01-01",
    });

    expect(status).toBe(400);
    expect(data).toEqual({ error: "Choose a date from the birth onwards." });
  });
});
