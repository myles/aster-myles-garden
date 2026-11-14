// Lays out a chart's tables side by side as CSV, with a blank column
// between each. Cells match the on-screen tables.

import type { Chart } from "@/lib/chart";
import type { Composite } from "@/lib/composite";
import type { HouseOverlay } from "@/lib/houses";
import type { Transits } from "@/lib/transits";

import { ASPECT_INFO, type Aspect, type AspectSettings } from "@/lib/aspects";
import { BODY_INFO } from "@/lib/bodies";
import { formatDegrees, formatNoAspects, formatPlacement } from "@/lib/format";
import { SolarReturnStyle, type SolarReturn } from "@/lib/solar-return";
import { compareCharts, type Synastry } from "@/lib/synastry";
import { formatLongitude } from "@/lib/zodiac";

type Row = string[];

type Table = { title: string; headings: Row; rows: Row[] };

/** RFC 4180 separates records with CRLF. */
const CSV_LINE_BREAK = "\r\n";

/** Without a byte-order mark, Excel reads UTF-8 glyphs as Latin-1. */
const UTF8_BOM = "\uFEFF";

const POSITION_HEADINGS: Row = ["Body", "Position"];
/** Only charts with a birth time have houses. */
const HOUSE_HEADING = "House";
const ASPECT_HEADINGS: Row = ["Pair", "Aspect", "Orb"];
const CROSS_ASPECT_HEADINGS: Row = ["Yours", "Aspect", "Theirs", "Orb"];
const TRANSIT_ASPECT_HEADINGS: Row = ["Transiting", "Aspect", "Natal", "Orb"];

const NO_TRANSITS_TEXT = "No transits within orb.";

/** Fields holding a comma, quote or line break must be quoted. */
const NEEDS_QUOTES_PATTERN = /[",\r\n]/;

/** One chart: its Positions and Aspects tables. */
export function buildChartCsv(chart: Chart): string {
  return layOutSideBySide([
    buildPositionsTable("Positions", chart),
    {
      title: "Aspects",
      headings: ASPECT_HEADINGS,
      rows: buildAspectRows(chart.aspects, chart.details.aspectSettings),
    },
  ]);
}

/** A composite: its Positions and Aspects tables, as for one chart. */
export function buildCompositeCsv(composite: Composite): string {
  return layOutSideBySide([
    buildPositionsTable("Composite positions", composite),
    {
      title: "Aspects",
      headings: ASPECT_HEADINGS,
      rows: buildAspectRows(
        composite.aspects,
        composite.first.details.aspectSettings,
      ),
    },
  ]);
}

/**
 * A comparison: each person's positions, with where their planets fall
 * in the other's houses, then the aspects between the two charts.
 */
export function buildComparisonCsv(synastry: Synastry): string {
  return layOutSideBySide([
    buildPositionsTable("Your positions", synastry.first, {
      heading: "Their house",
      houses: synastry.firstInSecondHouses,
    }),
    buildPositionsTable("Their positions", synastry.second, {
      heading: "Your house",
      houses: synastry.secondInFirstHouses,
    }),
    {
      title: "Aspects between you",
      headings: CROSS_ASPECT_HEADINGS,
      rows: buildCrossAspectRows(synastry),
    },
  ]);
}

/**
 * Transits: where the planets are at the chosen moment, with the natal
 * house each falls in, and the aspects they make to the natal planets.
 */
export function buildTransitsCsv(transits: Transits): string {
  return layOutSideBySide([
    buildPositionsTable(
      "Transiting positions",
      { bodies: transits.bodies, houses: undefined },
      { heading: "Your house", houses: transits.inNatalHouses },
    ),
    {
      title: "Transits to your chart",
      headings: TRANSIT_ASPECT_HEADINGS,
      rows: buildTransitRows(transits.aspects),
    },
  ]);
}

/** A return alone, or its positions and aspects against the natal chart. */
export function buildSolarReturnCsv(
  solarReturn: SolarReturn,
  style: SolarReturnStyle,
): string {
  if (style === SolarReturnStyle.Standalone) {
    return buildChartCsv(solarReturn.chart);
  }

  const comparison = compareCharts(solarReturn.natal, solarReturn.chart);
  const settings = solarReturn.natal.details.aspectSettings;

  return layOutSideBySide([
    buildPositionsTable("Positions", solarReturn.chart, {
      heading: "Natal house",
      houses: comparison.secondInFirstHouses,
    }),
    {
      title: "Aspects to natal chart",
      headings: ["Natal", "Aspect", "Return", "Orb"],
      rows:
        comparison.aspects.length > 0
          ? buildCrossAspectRows(comparison)
          : [[`${formatNoAspects(settings)} within orb.`, "", "", ""]],
    },
  ]);
}

function layOutSideBySide(tables: Table[]): string {
  const blank = (table: Table) => table.headings.map(() => "");
  const rowCount = Math.max(...tables.map((table) => table.rows.length));

  const rows: Row[] = [
    joinTables(tables.map((table) => [table.title, ...blank(table).slice(1)])),
    joinTables(tables.map((table) => table.headings)),
  ];

  for (let index = 0; index < rowCount; index++) {
    rows.push(
      joinTables(tables.map((table) => table.rows[index] ?? blank(table))),
    );
  }

  return UTF8_BOM + rows.map(formatRow).join(CSV_LINE_BREAK) + CSV_LINE_BREAK;
}

/** Example: [["a", "b"], ["c"]] → ["a", "b", "", "c"]. */
function joinTables(parts: Row[]): Row {
  return parts.flatMap((part, index) => (index === 0 ? part : ["", ...part]));
}

/**
 * Each body's position and house, plus the angles. A house overlay adds
 * a column for the house each body falls in on the other person's chart.
 */
function buildPositionsTable(
  title: string,
  chart: Pick<Chart, "bodies" | "houses">,
  overlay?: { heading: string; houses: HouseOverlay | undefined },
): Table {
  const { houses } = chart;
  const overlayHouses = overlay?.houses;
  const headings = [...POSITION_HEADINGS];

  if (houses) {
    headings.push(HOUSE_HEADING);
  }
  if (overlay?.houses) {
    headings.push(overlay.heading);
  }

  const rows = chart.bodies.map((placed) => {
    const info = BODY_INFO[placed.body];
    const row = [`${info.glyph} ${info.name}`, formatPlacement(placed)];

    if (houses) {
      row.push(String(placed.house));
    }
    if (overlayHouses) {
      row.push(String(overlayHouses[placed.body]));
    }

    return row;
  });

  if (houses) {
    const padding = headings.slice(POSITION_HEADINGS.length).map(() => "");
    rows.push(
      ["Ascendant", formatLongitude(houses.ascendant), ...padding],
      ["Midheaven", formatLongitude(houses.midheaven), ...padding],
    );
  }

  return { title, headings, rows };
}

function buildAspectRows(
  aspects: Aspect[],
  settings: AspectSettings | undefined,
): Row[] {
  if (aspects.length === 0) {
    return [[`${formatNoAspects(settings)} within orb.`, "", ""]];
  }

  return aspects.map((aspect) => {
    const first = BODY_INFO[aspect.first];
    const second = BODY_INFO[aspect.second];
    const info = ASPECT_INFO[aspect.type];

    return [
      `${first.glyph} ${first.name} – ${second.glyph} ${second.name}`,
      `${info.glyph} ${info.name}`,
      formatDegrees(aspect.orbDegrees),
    ];
  });
}

function buildCrossAspectRows({ aspects, first }: Synastry): Row[] {
  if (aspects.length === 0) {
    const settings = first.details.aspectSettings;
    return [[`${formatNoAspects(settings)} between you.`, "", "", ""]];
  }

  return aspects.map((aspect) => {
    const yours = BODY_INFO[aspect.first];
    const theirs = BODY_INFO[aspect.second];
    const info = ASPECT_INFO[aspect.type];

    return [
      `${yours.glyph} ${yours.name}`,
      `${info.glyph} ${info.name}`,
      `${theirs.glyph} ${theirs.name}`,
      formatDegrees(aspect.orbDegrees),
    ];
  });
}

/** Read transit first: "Transiting Saturn squares natal Sun". */
function buildTransitRows(aspects: Aspect[]): Row[] {
  if (aspects.length === 0) {
    return [[NO_TRANSITS_TEXT, "", "", ""]];
  }

  return aspects.map((aspect) => {
    const natal = BODY_INFO[aspect.first];
    const transiting = BODY_INFO[aspect.second];
    const info = ASPECT_INFO[aspect.type];

    return [
      `${transiting.glyph} ${transiting.name}`,
      `${info.glyph} ${info.name}`,
      `${natal.glyph} ${natal.name}`,
      formatDegrees(aspect.orbDegrees),
    ];
  });
}

function formatRow(row: Row): string {
  return row.map(escapeField).join(",");
}

/** Example: 'Say "hi"' → '"Say ""hi"""'. */
function escapeField(field: string): string {
  if (!NEEDS_QUOTES_PATTERN.test(field)) {
    return field;
  }

  return `"${field.replaceAll('"', '""')}"`;
}
