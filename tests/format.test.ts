import { describe, expect, it } from "vitest";

import { describeError, formatCoordinates, formatDegrees } from "@/lib/format";

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

describe("describeError", () => {
  it("uses an Error's message", () => {
    expect(describeError(new Error("No network"))).toBe("No network");
  });

  it("stringifies anything else", () => {
    expect(describeError("timed out")).toBe("timed out");
    expect(describeError(404)).toBe("404");
  });
});
