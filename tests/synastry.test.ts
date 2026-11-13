import { describe, expect, it } from "vitest";

import type { Chart } from "@/lib/chart";

import { AspectType } from "@/lib/aspects";
import { Body } from "@/lib/bodies";
import { compareCharts } from "@/lib/synastry";

import { CHART, CHART_WITHOUT_TIME } from "./fixtures/chart";

// Their Sun sits in your 1st house and their Mars in your 7th.
const THEIRS: Chart = {
  ...CHART,
  bodies: [
    { ...CHART.bodies[0], longitude: 10, house: 1 },
    { ...CHART.bodies[1], longitude: 190, house: 7 },
  ],
};

describe("compareCharts", () => {
  it("keeps both charts, yours first", () => {
    const synastry = compareCharts(CHART, THEIRS);

    expect(synastry.first).toBe(CHART);
    expect(synastry.second).toBe(THEIRS);
  });

  it("finds aspects from your planets to theirs", () => {
    const { aspects } = compareCharts(CHART, THEIRS);

    // Your Sun (280°) and Mars (100°) each square both of theirs.
    expect(aspects).toHaveLength(4);
    expect(aspects[0]).toEqual({
      first: Body.Sun,
      second: Body.Sun,
      type: AspectType.Square,
      orbDegrees: 0,
    });
  });

  it("places their planets in your houses, and yours in theirs", () => {
    const synastry = compareCharts(CHART, THEIRS);

    expect(synastry.secondInFirstHouses).toEqual({
      [Body.Sun]: 1,
      [Body.Mars]: 7,
    });
    // Both charts share the fixture's houses, so yours land as they are.
    expect(synastry.firstInSecondHouses).toEqual({
      [Body.Sun]: 10,
      [Body.Mars]: 4,
    });
  });

  it("skips overlays into a chart without a birth time", () => {
    const synastry = compareCharts(CHART_WITHOUT_TIME, THEIRS);

    expect(synastry.secondInFirstHouses).toBeUndefined();
    expect(synastry.firstInSecondHouses).toEqual({
      [Body.Sun]: 10,
      [Body.Mars]: 4,
    });
  });
});
