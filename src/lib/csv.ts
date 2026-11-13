// Lays out a chart's Positions and Aspects tables side by side as CSV,
// with a blank column between them. Cells match the on-screen tables.

import { ASPECT_INFO } from "@/lib/aspects";
import { BODY_INFO } from "@/lib/bodies";
import type { Chart } from "@/lib/chart";
import { formatDegrees, formatPlacement } from "@/lib/format";
import { formatLongitude } from "@/lib/zodiac";

type Row = string[];

/** RFC 4180 separates records with CRLF. */
const CSV_LINE_BREAK = "\r\n";

/** Without a byte-order mark, Excel reads UTF-8 glyphs as Latin-1. */
const UTF8_BOM = "\uFEFF";

const POSITION_HEADINGS: Row = ["Body", "Position"];
/** Only charts with a birth time have houses. */
const HOUSE_HEADING = "House";
const ASPECT_HEADINGS: Row = ["Pair", "Aspect", "Orb"];

const NO_ASPECTS_TEXT = "No major aspects within orb.";

/** Fields holding a comma, quote or line break must be quoted. */
const NEEDS_QUOTES_PATTERN = /[",\r\n]/;

export function buildChartCsv(chart: Chart): string {
  const positionHeadings = chart.houses
    ? [...POSITION_HEADINGS, HOUSE_HEADING]
    : POSITION_HEADINGS;
  const positions = buildPositionRows(chart);
  const aspects = buildAspectRows(chart);
  const bodyRowCount = Math.max(positions.length, aspects.length);
  const blankPositions = positionHeadings.map(() => "");
  const blankAspects = ASPECT_HEADINGS.map(() => "");

  const rows: Row[] = [
    ["Positions", ...blankPositions.slice(1), "", "Aspects", "", ""],
    [...positionHeadings, "", ...ASPECT_HEADINGS],
  ];

  for (let index = 0; index < bodyRowCount; index++) {
    rows.push([
      ...(positions[index] ?? blankPositions),
      "",
      ...(aspects[index] ?? blankAspects),
    ]);
  }

  return UTF8_BOM + rows.map(formatRow).join(CSV_LINE_BREAK) + CSV_LINE_BREAK;
}

function buildPositionRows(chart: Chart): Row[] {
  const { houses } = chart;
  const bodies = chart.bodies.map((placed) => {
    const info = BODY_INFO[placed.body];
    const row = [`${info.glyph} ${info.name}`, formatPlacement(placed)];

    return houses ? [...row, String(placed.house)] : row;
  });

  if (!houses) {
    return bodies;
  }

  const angles = [
    ["Ascendant", formatLongitude(houses.ascendant), ""],
    ["Midheaven", formatLongitude(houses.midheaven), ""],
  ];

  return [...bodies, ...angles];
}

function buildAspectRows(chart: Chart): Row[] {
  if (chart.aspects.length === 0) {
    return [[NO_ASPECTS_TEXT, "", ""]];
  }

  return chart.aspects.map((aspect) => {
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
