import { describe, expect, it } from "vitest";

import { ASPECT_INFO, AspectType } from "@/lib/aspects";
import { Body, BODY_INFO } from "@/lib/bodies";
import { buildChartCsv } from "@/lib/csv";

import { CHART } from "./fixtures/chart";

const UTF8_BOM = "﻿";

const SUN = `${BODY_INFO[Body.Sun].glyph} Sun`;
const MARS = `${BODY_INFO[Body.Mars].glyph} Mars`;
const OPPOSITION = `${ASPECT_INFO[AspectType.Opposition].glyph} Opposition`;
const SUN_MARS_ROW = `${SUN} – ${MARS},${OPPOSITION},0° 00′`;

function parseLines(csv: string): string[] {
  return csv.slice(UTF8_BOM.length).split("\r\n");
}

describe("buildChartCsv", () => {
  it("lays positions and aspects side by side", () => {
    expect(parseLines(buildChartCsv(CHART))).toEqual([
      "Positions,,,,Aspects,,",
      "Body,Position,House,,Pair,Aspect,Orb",
      `${SUN},10° 00′ Capricorn,10,,${SUN_MARS_ROW}`,
      `${MARS},10° 00′ Cancer ℞,4,,,,`,
      "Ascendant,0° 00′ Aries,,,,,",
      "Midheaven,0° 00′ Capricorn,,,,,",
      "",
    ]);
  });

  it("pads the positions side when aspects run longer", () => {
    const aspect = CHART.aspects[0];
    const chart = { ...CHART, aspects: Array(5).fill(aspect) };

    const lines = parseLines(buildChartCsv(chart));

    expect(lines).toHaveLength(2 + 5 + 1);
    expect(lines[6]).toBe(`,,,,${SUN_MARS_ROW}`);
  });

  it("says so when there are no aspects", () => {
    const lines = parseLines(buildChartCsv({ ...CHART, aspects: [] }));

    expect(lines[2]).toMatch(/,,No major aspects within orb\.,,$/);
  });

  it("starts with a byte-order mark for spreadsheet apps", () => {
    expect(buildChartCsv(CHART).startsWith(UTF8_BOM)).toBe(true);
  });

  it("quotes fields holding commas or quotes", () => {
    const sun = BODY_INFO[Body.Sun];
    const original = sun.name;
    sun.name = 'Sun, "Sol"';

    try {
      const lines = parseLines(buildChartCsv(CHART));
      expect(lines[2].startsWith(`"${sun.glyph} Sun, ""Sol""",`)).toBe(true);
    } finally {
      sun.name = original;
    }
  });
});
