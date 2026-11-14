import { describe, expect, it } from "vitest";

import {
  ASPECT_INFO,
  AspectSet,
  AspectType,
  OrbSize,
} from "@/lib/astrology/aspects";
import { Body, BODY_INFO } from "@/lib/astrology/bodies";
import { SolarReturnStyle } from "@/lib/charts/solar-return";
import { compareCharts } from "@/lib/charts/synastry";
import {
  buildChartCsv,
  buildComparisonCsv,
  buildCompositeCsv,
  buildProgressionsCsv,
  buildTransitsCsv,
  buildSolarReturnCsv,
} from "@/lib/downloads/csv";

import {
  CHART,
  CHART_WITHOUT_TIME,
  PROGRESSIONS,
  SOLAR_RETURN,
} from "../../fixtures/chart";

const UTF8_BOM = "\uFEFF";

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

  it("doesn't say major when minor aspects were looked for too", () => {
    const chart = {
      ...CHART,
      details: {
        ...CHART.details,
        aspectSettings: { aspectSet: AspectSet.All, orbSize: OrbSize.Standard },
      },
      aspects: [],
    };

    expect(parseLines(buildChartCsv(chart))[2]).toMatch(
      /,,No aspects within orb\.,,$/,
    );
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

describe("buildChartCsv without a birth time", () => {
  it("drops the House column and the angles", () => {
    expect(parseLines(buildChartCsv(CHART_WITHOUT_TIME))).toEqual([
      "Positions,,,Aspects,,",
      "Body,Position,,Pair,Aspect,Orb",
      `${SUN},10° 00′ Capricorn,,${SUN_MARS_ROW}`,
      `${MARS},10° 00′ Cancer ℞ (may be Leo),,,,`,
      "",
    ]);
  });
});

describe("buildCompositeCsv", () => {
  const composite = {
    first: CHART,
    second: CHART,
    bodies: CHART.bodies,
    houses: CHART.houses,
    aspects: [],
  };

  it("lays out the composite's positions and aspects", () => {
    const lines = parseLines(buildCompositeCsv(composite));

    expect(lines[0]).toBe("Composite positions,,,,Aspects,,");
    expect(lines[1]).toBe("Body,Position,House,,Pair,Aspect,Orb");
    expect(lines[2]).toMatch(/,,No major aspects within orb\.,,$/);
  });
});

describe("buildComparisonCsv", () => {
  // Their Sun at 190° squares your Sun and Mars, and sits in your 7th.
  const theirs = {
    ...CHART,
    bodies: [{ ...CHART.bodies[0], longitude: 190, house: 7 }],
  };
  const SQUARE = `${ASPECT_INFO[AspectType.Square].glyph} Square`;

  it("lays out both people's positions and the aspects between them", () => {
    expect(
      parseLines(buildComparisonCsv(compareCharts(CHART, theirs))),
    ).toEqual([
      "Your positions,,,,,Their positions,,,,,Aspects between you,,,",
      "Body,Position,House,Their house,,Body,Position,House,Your house,," +
        "Yours,Aspect,Theirs,Orb",
      `${SUN},10° 00′ Capricorn,10,10,,${SUN},10° 00′ Libra,7,7,,` +
        `${SUN},${SQUARE},${SUN},0° 00′`,
      `${MARS},10° 00′ Cancer ℞,4,4,,Ascendant,0° 00′ Aries,,,,` +
        `${MARS},${SQUARE},${SUN},0° 00′`,
      "Ascendant,0° 00′ Aries,,,,Midheaven,0° 00′ Capricorn,,,,,,,",
      "Midheaven,0° 00′ Capricorn,,,,,,,,,,,,",
      "",
    ]);
  });

  it("leaves out houses that need a missing birth time", () => {
    const lines = parseLines(
      buildComparisonCsv(compareCharts(CHART_WITHOUT_TIME, theirs)),
    );

    // You have no houses, so neither your House nor their "Your house".
    expect(lines[1]).toBe(
      "Body,Position,Their house,,Body,Position,House,,Yours,Aspect,Theirs,Orb",
    );
  });

  it("says so when there are no aspects between you", () => {
    const apart = {
      ...CHART,
      bodies: [{ ...CHART.bodies[0], longitude: 325 }],
    };
    const lines = parseLines(buildComparisonCsv(compareCharts(CHART, apart)));

    expect(lines[2]).toMatch(/,,No major aspects between you\.,,,$/);
  });
});

describe("buildTransitsCsv", () => {
  // Transiting Sun at 190° squares natal Sun and Mars; it's in house 7.
  const transits = {
    natal: CHART,
    at: new Date("2026-11-13T20:00:00Z"),
    bodies: [{ ...CHART.bodies[0], longitude: 190, house: undefined }],
    aspects: [
      {
        first: Body.Mars,
        second: Body.Sun,
        type: AspectType.Square,
        orbDegrees: 1.5,
      },
    ],
    inNatalHouses: { [Body.Sun]: 7 },
  };
  const SQUARE = `${ASPECT_INFO[AspectType.Square].glyph} Square`;

  it("lists the transiting planets and their aspects to your chart", () => {
    expect(parseLines(buildTransitsCsv(transits))).toEqual([
      "Transiting positions,,,,Transits to your chart,,,",
      "Body,Position,Your house,,Transiting,Aspect,Natal,Orb",
      `${SUN},10° 00′ Libra,7,,${SUN},${SQUARE},${MARS},1° 30′`,
      "",
    ]);
  });

  it("leaves out your houses without a birth time", () => {
    const lines = parseLines(
      buildTransitsCsv({ ...transits, inNatalHouses: undefined }),
    );

    expect(lines[1]).toBe("Body,Position,,Transiting,Aspect,Natal,Orb");
  });

  it("says so when nothing is transiting your chart", () => {
    const lines = parseLines(buildTransitsCsv({ ...transits, aspects: [] }));

    expect(lines[2]).toMatch(/,,No transits within orb\.,,,$/);
  });
});

describe("buildProgressionsCsv", () => {
  const QUINCUNX = `${ASPECT_INFO[AspectType.Quincunx].glyph} Quincunx`;

  it("lists the progressed planets and their aspects to your chart", () => {
    expect(parseLines(buildProgressionsCsv(PROGRESSIONS))).toEqual([
      "Progressed positions,,,,Progressions to your chart,,,",
      "Body,Position,Your house,,Progressed,Aspect,Natal,Orb",
      `${SUN},10° 30′ Aquarius,11,,${SUN},${QUINCUNX},${MARS},0° 30′`,
      "",
    ]);
  });

  it("says so when nothing progressed is in orb", () => {
    const lines = parseLines(
      buildProgressionsCsv({ ...PROGRESSIONS, aspects: [] }),
    );

    expect(lines[2]).toMatch(/,,No progressions within orb\.,,,$/);
  });
});

describe("buildSolarReturnCsv", () => {
  it("keeps the standalone return tables", () => {
    expect(buildSolarReturnCsv(SOLAR_RETURN, SolarReturnStyle.Standalone)).toBe(
      buildChartCsv(SOLAR_RETURN.chart),
    );
  });

  it("exports return positions with natal houses and cross aspects", () => {
    const csv = buildSolarReturnCsv(SOLAR_RETURN, SolarReturnStyle.BiWheel);
    expect(csv).toContain("Natal house");
    expect(csv).toContain("Aspects to natal chart");
    expect(csv).toContain("Conjunction");
  });

  it("lays out cross aspects as the on-screen table does", () => {
    const lines = parseLines(
      buildSolarReturnCsv(SOLAR_RETURN, SolarReturnStyle.BiWheel),
    );

    expect(lines[1]).toMatch(/,,Pair,Aspect,Orb$/);
    expect(lines[2]).toMatch(/,,\S+ Natal \w+ – \S+ Return \w+,[^,]+,[^,]+$/);
  });

  it("explains when there are no cross aspects", () => {
    const solarReturn = {
      ...SOLAR_RETURN,
      chart: { ...SOLAR_RETURN.chart, bodies: [] },
    };
    const lines = parseLines(
      buildSolarReturnCsv(solarReturn, SolarReturnStyle.BiWheel),
    );

    expect(lines[2]).toMatch(/,,No major aspects within orb\.,,$/);
  });
});
