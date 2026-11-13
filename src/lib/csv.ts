// Lays out a chart's tables side by side as CSV, with a blank column
// between each. Cells match the on-screen tables.

import { ASPECT_INFO, type Aspect } from "@/lib/aspects";
import { BODY_INFO } from "@/lib/bodies";
import type { Chart } from "@/lib/chart";
import { formatDegrees, formatPlacement } from "@/lib/format";
import type { HouseOverlay, Synastry } from "@/lib/synastry";
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

const NO_ASPECTS_TEXT = "No major aspects within orb.";
const NO_CROSS_ASPECTS_TEXT = "No major aspects between you.";

/** Fields holding a comma, quote or line break must be quoted. */
const NEEDS_QUOTES_PATTERN = /[",\r\n]/;

/** One chart: its Positions and Aspects tables. */
export function buildChartCsv(chart: Chart): string {
  return layOutSideBySide([
    buildPositionsTable("Positions", chart),
    {
      title: "Aspects",
      headings: ASPECT_HEADINGS,
      rows: buildAspectRows(chart.aspects),
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
      rows: buildCrossAspectRows(synastry.aspects),
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
  chart: Chart,
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

function buildAspectRows(aspects: Aspect[]): Row[] {
  if (aspects.length === 0) {
    return [[NO_ASPECTS_TEXT, "", ""]];
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

function buildCrossAspectRows(aspects: Aspect[]): Row[] {
  if (aspects.length === 0) {
    return [[NO_CROSS_ASPECTS_TEXT, "", "", ""]];
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
