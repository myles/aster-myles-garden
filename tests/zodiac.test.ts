import { describe, expect, it } from "vitest";

import {
  formatLongitude,
  getSign,
  normalizeDegrees,
  separateDegrees,
} from "@/lib/zodiac";

describe("normalizeDegrees", () => {
  it("wraps values into [0, 360)", () => {
    expect(normalizeDegrees(370)).toBe(10);
    expect(normalizeDegrees(-10)).toBe(350);
    expect(normalizeDegrees(360)).toBe(0);
  });
});

describe("separateDegrees", () => {
  it("measures the short way round the circle", () => {
    expect(separateDegrees(10, 350)).toBe(20);
    expect(separateDegrees(0, 180)).toBe(180);
    expect(separateDegrees(90, 30)).toBe(60);
  });
});

describe("getSign", () => {
  it("maps longitude to sign", () => {
    expect(getSign(0).name).toBe("Aries");
    expect(getSign(29.999).name).toBe("Aries");
    expect(getSign(30).name).toBe("Taurus");
    expect(getSign(359).name).toBe("Pisces");
    expect(getSign(-1).name).toBe("Pisces");
  });
});

describe("formatLongitude", () => {
  it("formats degrees and minutes within the sign", () => {
    expect(formatLongitude(280.37)).toBe("10° 22′ Capricorn");
    expect(formatLongitude(0)).toBe("0° 00′ Aries");
  });

  it("rolls rounded minutes over into the next sign", () => {
    expect(formatLongitude(29.9999)).toBe("0° 00′ Taurus");
    expect(formatLongitude(359.9999)).toBe("0° 00′ Aries");
  });
});
