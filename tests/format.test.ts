import { describe, expect, it } from "vitest";

import {
  describeError,
  formatBirthDate,
  formatBirthMoment,
  formatCoordinates,
  formatDegrees,
  formatInstant,
  formatPlacement,
} from "@/lib/format";

import { CHART, CHART_WITHOUT_TIME } from "./fixtures/chart";

describe("formatDegrees", () => {
  it("formats degrees and minutes", () => {
    expect(formatDegrees(2.5)).toBe("2° 30′");
    expect(formatDegrees(0)).toBe("0° 00′");
  });

  it("rounds minutes up into the next degree", () => {
    expect(formatDegrees(1.9999)).toBe("2° 00′");
  });

  it("ignores sign", () => {
    expect(formatDegrees(-0.25)).toBe("0° 15′");
  });
});

describe("formatCoordinates", () => {
  it("labels hemispheres", () => {
    expect(formatCoordinates(43.7064, -79.3986)).toBe("43.71° N, 79.40° W");
    expect(formatCoordinates(-33.8688, 151.2093)).toBe("33.87° S, 151.21° E");
  });
});

describe("formatPlacement", () => {
  const [sun, mars] = CHART.bodies;
  const [sunWithoutTime, marsWithoutTime] = CHART_WITHOUT_TIME.bodies;

  it("gives the sign position", () => {
    expect(formatPlacement(sun)).toBe("10° 00′ Capricorn");
  });

  it("marks retrograde bodies", () => {
    expect(formatPlacement(mars)).toBe("10° 00′ Cancer ℞");
  });

  it("names the other sign a body may be in without a birth time", () => {
    expect(formatPlacement(marsWithoutTime)).toBe(
      "10° 00′ Cancer ℞ (may be Leo)",
    );
  });

  it("adds nothing when the sign is certain", () => {
    expect(formatPlacement(sunWithoutTime)).toBe("10° 00′ Capricorn");
  });
});

describe("formatBirthDate", () => {
  it("gives the date in the birthplace's time zone", () => {
    expect(formatBirthDate(CHART)).toBe("1 January 2000");
  });
});

describe("formatBirthMoment", () => {
  it("gives local time, zone and universal time", () => {
    expect(formatBirthMoment(CHART)).toBe(
      "1 January 2000 at 12:00 GMT (12:00 UT)",
    );
  });
});

describe("formatInstant", () => {
  it("gives the moment on a time zone's clock", () => {
    expect(
      formatInstant(new Date("2026-11-13T20:05:00Z"), "America/Toronto"),
    ).toBe("13 November 2026 at 15:05 EST");
  });
});

describe("describeError", () => {
  it("uses an Error's message", () => {
    expect(describeError(new Error("No network"))).toBe("No network");
  });

  it("stringifies anything else", () => {
    expect(describeError("timed out")).toBe("timed out");
    expect(describeError(404)).toBe("404");
  });
});
