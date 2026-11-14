// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { AspectType } from "@/lib/astrology/aspects";
import { separateDegrees } from "@/lib/astrology/zodiac";
import { compareCharts } from "@/lib/charts/synastry";
import { describeBiWheel, describeWheel } from "@/lib/wheel/describe";
import { drawBiWheel, drawWheel, spreadLongitudes } from "@/lib/wheel/wheel";

import { CHART, CHART_WITHOUT_TIME } from "./fixtures/chart";

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

  it("keeps a tight pair apart inside a crowded cluster", () => {
    // Pushing the first pair apart moves the middle body past the last,
    // which once read as a near-360° gap and left them overlapping.
    const [mercury, mars, sun, saturn] = spreadLongitudes([
      334.93, 338.25, 347.52, 347.82,
    ]);

    expect(sun).toBeLessThan(saturn);
    for (const [a, b] of [
      [mercury, mars],
      [mars, sun],
      [sun, saturn],
    ]) {
      expect(separateDegrees(a, b)).toBeGreaterThanOrEqual(7.99);
    }
  });
});

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

type Box = { left: number; right: number; top: number; bottom: number };

// Conservative text bounds at the wheel's 11px font size.
const CHARACTER_WIDTH_PX = 7.5;
const TEXT_HEIGHT_PX = 12;
const TEXT_CLEARANCE_PX = 1;

/** Where a <text> is drawn, from its anchor and centred baseline. */
function estimateTextBox(text: Element): Box {
  const x = Number(text.getAttribute("x"));
  const y = Number(text.getAttribute("y"));
  const width = (text.textContent?.length ?? 0) * CHARACTER_WIDTH_PX;
  const anchor = text.getAttribute("text-anchor");
  const left =
    anchor === "start" ? x : anchor === "end" ? x - width : x - width / 2;

  return {
    left,
    right: left + width,
    top: y - TEXT_HEIGHT_PX / 2,
    bottom: y + TEXT_HEIGHT_PX / 2,
  };
}

function overlaps(a: Box, b: Box): boolean {
  return (
    a.left < b.right + TEXT_CLEARANCE_PX &&
    a.right > b.left - TEXT_CLEARANCE_PX &&
    a.top < b.bottom + TEXT_CLEARANCE_PX &&
    a.bottom > b.top - TEXT_CLEARANCE_PX
  );
}

/** Samples the line, which is enough at these sizes. */
function crosses(line: Element, box: Box): boolean {
  const [x1, y1, x2, y2] = ["x1", "y1", "x2", "y2"].map((name) =>
    Number(line.getAttribute(name)),
  );
  const steps = 200;

  for (let step = 0; step <= steps; step++) {
    const x = x1 + ((x2 - x1) * step) / steps;
    const y = y1 + ((y2 - y1) * step) / steps;

    if (x > box.left && x < box.right && y > box.top && y < box.bottom) {
      return true;
    }
  }

  return false;
}

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

  it("takes another name, for a wheel that isn't a natal chart", () => {
    const { bodies, houses, aspects } = CHART;
    drawWheel(svg, { bodies, houses, aspects }, "Composite chart wheel");

    expect(svg.querySelector(":scope > title")?.textContent).toBe(
      "Composite chart wheel",
    );
  });

  it("carries a written description of itself", () => {
    const description = svg.querySelector(":scope > desc");

    expect(svg.getAttribute("aria-describedby")).toBe(description?.id);
    expect(description?.textContent).toBe(describeWheel(CHART).join(" "));
  });

  it("rewrites the description when redrawn", () => {
    drawWheel(svg, CHART_WITHOUT_TIME);

    expect(svg.querySelectorAll(":scope > desc")).toHaveLength(1);
    expect(svg.querySelector(":scope > desc")?.textContent).toContain(
      "There's no birth time",
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

  it("marks minor aspect lines, so they can be drawn dashed", () => {
    expect(count(".wheel-aspect--minor")).toBe(0);

    const [aspect] = CHART.aspects;
    drawWheel(svg, {
      ...CHART,
      aspects: [{ ...aspect, type: AspectType.Quincunx }],
    });

    expect(count(".wheel-aspect--minor")).toBe(1);
  });

  it("puts the ascendant at nine o'clock", () => {
    // AC label sits 4° past the ascendant, just left of centre-line.
    const label = [...svg.querySelectorAll(".wheel-axis-label")].find(
      (element) => element.textContent === "AC",
    );
    expect(Number(label?.getAttribute("x"))).toBeLessThan(150);
  });

  it.each([0, 45, 90, 135, 180, 225, 270, 315])(
    "keeps angle labels clear of bodies at %s degrees",
    (longitude) => {
      drawWheel(svg, {
        ...CHART,
        houses: { ...CHART.houses!, midheaven: longitude },
        bodies: CHART.bodies.map((body, index) => ({
          ...body,
          longitude: longitude + 4 + index * 180,
          isRetrograde: true,
        })),
      });

      const neighbours = [
        ...svg.querySelectorAll(
          ".wheel-body-degree, .wheel-body-retrograde, .wheel-house-number",
        ),
      ].map(estimateTextBox);

      for (const label of svg.querySelectorAll(".wheel-axis-label")) {
        const box = estimateTextBox(label);

        for (const neighbour of neighbours) {
          expect(overlaps(box, neighbour)).toBe(false);
        }
      }
    },
  );

  it.each([0, 45, 90, 135, 180, 225, 270, 315])(
    "keeps angle labels off their own axis at %s degrees",
    (longitude) => {
      drawWheel(svg, {
        ...CHART,
        houses: { ...CHART.houses!, midheaven: longitude },
      });

      const axes = svg.querySelectorAll(".wheel-axis");
      const labels = svg.querySelectorAll(".wheel-axis-label");

      labels.forEach((label, index) => {
        expect(crosses(axes[index], estimateTextBox(label))).toBe(false);
      });
    },
  );

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

describe("drawWheel without a birth time", () => {
  let svg: SVGSVGElement;

  const count = (selector: string) => svg.querySelectorAll(selector).length;

  beforeEach(() => {
    svg = document.createElementNS(SVG_NAMESPACE, "svg");
    drawWheel(svg, CHART_WITHOUT_TIME);
  });

  it("leaves out houses and angles", () => {
    expect(count(".wheel-cusp")).toBe(0);
    expect(count(".wheel-house-number")).toBe(0);
    expect(count(".wheel-axis")).toBe(0);
    expect(count(".wheel-axis-label")).toBe(0);
  });

  it("still draws signs, bodies and aspects", () => {
    expect(count("path.wheel-sign")).toBe(12);
    expect(count("g.wheel-body")).toBe(2);
    expect(count(".wheel-aspect")).toBe(1);
  });

  it("puts 0° Aries at nine o'clock", () => {
    const aries = svg.querySelector(".wheel-sign-glyph");
    // Aries' glyph sits mid-sign, 15° below the left of the wheel.
    expect(Number(aries?.getAttribute("x"))).toBeLessThan(60);
    expect(Number(aries?.getAttribute("y"))).toBeGreaterThan(300);
  });

  it("clears houses left by a chart with a time", () => {
    drawWheel(svg, CHART);
    expect(count(".wheel-cusp")).toBe(12);

    drawWheel(svg, CHART_WITHOUT_TIME);

    expect(count(".wheel-cusp")).toBe(0);
    expect(count(".wheel-axis-label")).toBe(0);
  });
});

describe("drawBiWheel", () => {
  // Their Sun squares your Sun and your Mars: two lines, where your own
  // chart has one (its Sun–Mars opposition).
  const theirs = {
    ...CHART,
    bodies: [{ ...CHART.bodies[0], longitude: 190 }],
  };
  const synastry = compareCharts(CHART, theirs);
  const biWheel = {
    inner: CHART,
    outerBodies: theirs.bodies,
    aspects: synastry.aspects,
    title: "Chart comparison wheel",
    innerLabel: "Your",
    outerLabel: "Their",
  };

  let svg: SVGSVGElement;

  const count = (selector: string) => svg.querySelectorAll(selector).length;

  beforeEach(() => {
    svg = document.createElementNS(SVG_NAMESPACE, "svg");
    drawBiWheel(svg, biWheel);
  });

  it("describes both rings", () => {
    expect(svg.querySelector(":scope > desc")?.textContent).toBe(
      describeBiWheel(biWheel).join(" "),
    );
  });

  it("widens the view to fit the outer ring", () => {
    expect(svg.getAttribute("viewBox")).toBe("-90 -90 780 780");
    expect(svg.querySelector(":scope > title")?.textContent).toBe(
      "Chart comparison wheel",
    );
  });

  it("draws your bodies inside and theirs outside", () => {
    expect(count("g.wheel-body:not(.wheel-body--outer)")).toBe(2);
    expect(count("g.wheel-body--outer")).toBe(1);
    expect(svg.querySelector("g.wheel-body--outer title")?.textContent).toBe(
      "Their Sun",
    );
  });

  it("draws their bodies outside the zodiac", () => {
    const glyph = svg.querySelector(".wheel-body--outer .wheel-body-glyph");
    const x = Number(glyph?.getAttribute("x")) - 300;
    const y = Number(glyph?.getAttribute("y")) - 300;

    expect(Math.hypot(x, y)).toBeCloseTo(322, 0);
  });

  it("draws aspects between the charts, not within yours", () => {
    expect(synastry.aspects).toHaveLength(2);
    expect(count(".wheel-aspect")).toBe(2);
  });

  it("keeps your houses", () => {
    expect(count(".wheel-cusp")).toBe(12);
  });

  it("returns to a single wheel cleanly", () => {
    drawWheel(svg, CHART);

    expect(svg.getAttribute("viewBox")).toBe("0 0 600 600");
    expect(count("g.wheel-body--outer")).toBe(0);
    expect(count(".wheel-ring--faint")).toBe(1);
    expect(count(".wheel-aspect")).toBe(1);
  });
});
