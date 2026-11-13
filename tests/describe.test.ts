import { describe, expect, it } from "vitest";

import { describeBiWheel, describeWheel } from "@/lib/describe";
import { compareCharts } from "@/lib/synastry";

import { CHART, CHART_WITHOUT_TIME } from "./fixtures/chart";

// CHART: ascendant 0° Aries, Sun 280° (Capricorn, house 10), Mars 100°
// (Cancer, house 4, retrograde), Sun–Mars opposition.

describe("describeWheel", () => {
  it("describes the wheel as it's laid out", () => {
    expect(describeWheel(CHART)).toEqual([
      "The ascendant, 0° 00′ Aries, is on the left, and the midheaven, " +
        "0° 00′ Capricorn, is towards the top.",
      "Going anticlockwise from the left — Cancer: Mars (house 4, " +
        "retrograde); Capricorn: Sun (house 10).",
      "Planets by element: 1 earth, 1 water.",
      "1 planet is above the horizon and 1 below.",
      "1 aspect line crosses the centre: 1 challenging.",
    ]);
  });

  it("explains a wheel without a birth time", () => {
    expect(describeWheel(CHART_WITHOUT_TIME)).toEqual([
      "There's no birth time, so no houses or angles; 0° Aries is on the " +
        "left.",
      "Going anticlockwise from the left — Cancer: Mars (retrograde, may " +
        "be in Leo); Capricorn: Sun.",
      "Planets by element: 1 earth, 1 water.",
      "1 aspect line crosses the centre: 1 challenging.",
    ]);
  });

  it("groups bodies that share a sign", () => {
    const chart = {
      ...CHART,
      bodies: CHART.bodies.map((placed) => ({
        ...placed,
        longitude: 280,
        house: 10,
        isRetrograde: false,
      })),
    };

    expect(describeWheel(chart)[1]).toBe(
      "Going anticlockwise from the left — Capricorn: Sun (house 10), " +
        "Mars (house 10).",
    );
  });

  it("says when no aspect lines are drawn", () => {
    expect(describeWheel({ ...CHART, aspects: [] }).at(-1)).toBe(
      "No aspect lines cross the centre.",
    );
  });
});

describe("describeBiWheel", () => {
  // Their Sun at 190° squares your Sun and your Mars.
  const theirs = {
    ...CHART,
    bodies: [{ ...CHART.bodies[0], longitude: 190 }],
  };

  it("describes both rings and the lines between them", () => {
    expect(
      describeBiWheel({
        inner: CHART,
        outerBodies: theirs.bodies,
        aspects: compareCharts(CHART, theirs).aspects,
        title: "Chart comparison wheel",
        innerLabel: "Your",
        outerLabel: "Their",
      }),
    ).toEqual([
      "The ascendant, 0° 00′ Aries, is on the left, and the midheaven, " +
        "0° 00′ Capricorn, is towards the top.",
      "Inside, your planets, going anticlockwise from the left — Cancer: " +
        "Mars (house 4, retrograde); Capricorn: Sun (house 10).",
      "Outside, their planets — Libra: Sun.",
      "2 aspect lines link the two rings: 2 challenging.",
    ]);
  });
});
