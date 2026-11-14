import { describe, expect, it } from "vitest";

import type { Chart } from "@/lib/charts/chart";

import {
  AspectSet,
  AspectType,
  DEFAULT_ASPECT_SETTINGS,
} from "@/lib/astrology/aspects";
import { Body } from "@/lib/astrology/bodies";
import { compareCharts } from "@/lib/charts/synastry";

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

  it("uses your chart's aspect settings", () => {
    // Their Sun at 70° is a quincunx to your Sun at 280°.
    const theirs = {
      ...CHART,
      bodies: [{ ...CHART.bodies[0], longitude: 70 }],
    };
    const yours = {
      ...CHART,
      details: {
        ...CHART.details,
        aspectSettings: {
          ...DEFAULT_ASPECT_SETTINGS,
          aspectSet: AspectSet.All,
        },
      },
    };
    const quincunx = {
      first: Body.Sun,
      second: Body.Sun,
      type: AspectType.Quincunx,
      orbDegrees: 0,
    };

    expect(compareCharts(CHART, theirs).aspects).not.toContainEqual(quincunx);
    expect(compareCharts(yours, theirs).aspects).toContainEqual(quincunx);
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
