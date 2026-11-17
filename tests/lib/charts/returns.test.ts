import { describe, expect, it } from "vitest";

import { Body } from "@/lib/astrology/bodies";
import { findBody, isReturnStyle, ReturnStyle } from "@/lib/charts/returns";

describe("isReturnStyle", () => {
  it.each(Object.values(ReturnStyle))("accepts %s", (style) => {
    expect(isReturnStyle(style)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isReturnStyle("other")).toBe(false);
  });
});

describe("findBody", () => {
  it("finds the body asked for", () => {
    const moon = { body: Body.Moon, longitude: 10 };

    expect(findBody([{ body: Body.Sun, longitude: 0 }, moon], Body.Moon)).toBe(
      moon,
    );
  });

  it("says which body is missing", () => {
    expect(() => findBody([], Body.Moon)).toThrow("The chart has no Moon.");
  });
});
