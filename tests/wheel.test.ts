// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { drawWheel, spreadLongitudes } from "@/lib/wheel";
import { separateDegrees } from "@/lib/zodiac";

import { CHART } from "./fixtures/chart";

describe("spreadLongitudes", () => {
  it("leaves well-separated bodies alone", () => {
    expect(spreadLongitudes([10, 100, 200])).toEqual([10, 100, 200]);
  });

  it("fans out crowded bodies, keeping input order", () => {
    const [sun, mercury] = spreadLongitudes([12, 10]);
    expect(separateDegrees(sun, mercury)).toBeGreaterThanOrEqual(7.99);
    expect(sun).toBeGreaterThan(mercury);
  });

  it("spreads across 0° Aries", () => {
    const [a, b] = spreadLongitudes([359, 1]);
    expect(separateDegrees(a, b)).toBeGreaterThanOrEqual(7.99);
  });
});

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

describe("drawWheel", () => {
  let svg: SVGSVGElement;

  const count = (selector: string) => svg.querySelectorAll(selector).length;

  beforeEach(() => {
    svg = document.createElementNS(SVG_NAMESPACE, "svg");
    drawWheel(svg, CHART);
  });

  it("produces a labelled SVG", () => {
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("viewBox")).toBe("0 0 600 600");
    expect(svg.querySelector(":scope > title")?.textContent).toBe(
      "Natal chart wheel",
    );
  });

  it("draws all signs, houses and bodies", () => {
    expect(count("path.wheel-sign")).toBe(12);
    expect(count(".wheel-house-number")).toBe(12);
    expect(count("g.wheel-body")).toBe(2);
  });

  it("marks retrograde bodies", () => {
    expect(count(".wheel-body-retrograde")).toBe(1);
  });

  it("draws aspect lines by quality", () => {
    expect(count(".wheel-aspect--challenging")).toBe(1);
  });

  it("puts the ascendant at nine o'clock", () => {
    // AC label sits 4° past the ascendant, just left of centre-line.
    const label = [...svg.querySelectorAll(".wheel-axis-label")].find(
      (element) => element.textContent === "AC",
    );
    expect(Number(label?.getAttribute("x"))).toBeLessThan(150);
  });

  it("updates in place when redrawn", () => {
    const sun = svg.querySelector("g.wheel-body");
    const direct = {
      ...CHART,
      bodies: CHART.bodies.map((body) => ({ ...body, isRetrograde: false })),
      aspects: [],
    };

    drawWheel(svg, direct);

    expect(count("path.wheel-sign")).toBe(12);
    expect(count("g.wheel-body")).toBe(2);
    expect(count(".wheel-body-retrograde")).toBe(0);
    expect(count(".wheel-aspect")).toBe(0);
    expect(svg.querySelector("g.wheel-body")).toBe(sun);
  });
});
