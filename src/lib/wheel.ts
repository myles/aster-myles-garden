// Renders a chart as an SVG wheel with D3. Geometry is computed as plain
// data first, then joined to the DOM, so redrawing a chart updates the
// existing elements in place. Colours come from CSS classes.

import { ASPECT_INFO } from "@/lib/aspects";
import { BODY_INFO } from "@/lib/bodies";
import type { Chart, PlacedBody } from "@/lib/chart";
import { HOUSE_COUNT } from "@/lib/houses";
import {
  DEGREES_PER_CIRCLE,
  DEGREES_PER_SIGN,
  normalizeDegrees,
  SIGNS,
} from "@/lib/zodiac";
import { select, type Selection } from "d3-selection";
import { arc } from "d3-shape";

export const WHEEL_SIZE_PX = 600;
const CENTRE_PX = WHEEL_SIZE_PX / 2;

const ZODIAC_OUTER_RADIUS_PX = 290;
const ZODIAC_INNER_RADIUS_PX = 250;
const SIGN_GLYPH_RADIUS_PX = 270;
const MINOR_TICK_LENGTH_PX = 4;
const MAJOR_TICK_LENGTH_PX = 8;
const BODY_POINTER_LENGTH_PX = 10;
const BODY_GLYPH_RADIUS_PX = 220;
const BODY_LEADER_GAP_PX = 12;
const BODY_DEGREE_RADIUS_PX = 194;
const BODY_RETROGRADE_RADIUS_PX = 176;
const HOUSE_RING_RADIUS_PX = 152;
const HOUSE_NUMBER_RADIUS_PX = 138;
const ASPECT_RADIUS_PX = 124;
const ANGLE_LABEL_RADIUS_PX = 164;
const ANGLE_LABEL_OFFSET_DEGREES = 4;

const MAJOR_TICK_INTERVAL_DEGREES = 5;

/** Bodies closer than this are fanned out so their glyphs don't overlap. */
const MIN_GLYPH_SEPARATION_DEGREES = 8;
const SPREAD_ITERATIONS = 60;

const COORDINATE_DECIMALS = 2;

const WHEEL_TITLE_ID = "wheel-title";

/** Paint order, back to front. Each layer is one <g>. */
const LAYERS = [
  "outer-ring",
  "signs",
  "ticks",
  "rings",
  "houses",
  "axes",
  "aspects",
  "bodies",
] as const;

type Layer = (typeof LAYERS)[number];

type Point = { x: number; y: number };
type Segment = { from: Point; to: Point; className: string };
type Label = { at: Point; text: string; className: string };
type Ring = { radius: number; className: string };

type BodyMark = {
  key: string;
  name: string;
  segments: Segment[];
  labels: Label[];
};

// D3's Selection is invariant in every type parameter, so a helper that
// only appends children has to accept any selection.
type Parent = Selection<any, any, any, any>;

/**
 * Projects an ecliptic longitude onto the wheel. The ascendant sits at
 * nine o'clock and the zodiac runs anticlockwise, as on a printed chart.
 */
function project(longitude: number, ascendant: number, radius: number): Point {
  const radians = ((180 + longitude - ascendant) * Math.PI) / 180;
  return {
    x: CENTRE_PX + radius * Math.cos(radians),
    y: CENTRE_PX - radius * Math.sin(radians),
  };
}

/**
 * Converts a longitude to a d3-shape angle, which is in radians and runs
 * clockwise from twelve o'clock. Matches the projection used above.
 */
function toArcAngle(longitude: number, ascendant: number): number {
  return ((ascendant - longitude - 90) * Math.PI) / 180;
}

function round(value: number): number {
  return Number(value.toFixed(COORDINATE_DECIMALS));
}

function joinLines(parent: Parent, segments: Segment[]): void {
  parent
    .selectAll("line")
    .data(segments)
    .join("line")
    .attr("class", (d) => d.className)
    .attr("x1", (d) => round(d.from.x))
    .attr("y1", (d) => round(d.from.y))
    .attr("x2", (d) => round(d.to.x))
    .attr("y2", (d) => round(d.to.y));
}

function joinLabels(parent: Parent, labels: Label[]): void {
  parent
    .selectAll("text")
    .data(labels)
    .join("text")
    .attr("class", (d) => d.className)
    .attr("x", (d) => round(d.at.x))
    .attr("y", (d) => round(d.at.y))
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central")
    .text((d) => d.text);
}

function joinRings(parent: Parent, rings: Ring[]): void {
  parent
    .selectAll("circle")
    .data(rings)
    .join("circle")
    .attr("class", (d) => d.className)
    .attr("cx", CENTRE_PX)
    .attr("cy", CENTRE_PX)
    .attr("r", (d) => d.radius);
}

function drawSigns(parent: Parent, ascendant: number): void {
  // Each datum is the sign's starting longitude.
  const sector = arc<number>()
    .innerRadius(ZODIAC_INNER_RADIUS_PX)
    .outerRadius(ZODIAC_OUTER_RADIUS_PX)
    .startAngle((start) => toArcAngle(start, ascendant))
    .endAngle((start) => toArcAngle(start + DEGREES_PER_SIGN, ascendant))
    .digits(COORDINATE_DECIMALS);

  parent
    .selectAll("path")
    .data(SIGNS.map((_, index) => index * DEGREES_PER_SIGN))
    .join("path")
    .attr(
      "class",
      (_, index) => `wheel-sign wheel-sign--${SIGNS[index].element}`,
    )
    .attr("transform", `translate(${CENTRE_PX} ${CENTRE_PX})`)
    .attr("d", sector);

  joinLabels(
    parent,
    SIGNS.map((sign, index) => {
      const middle = index * DEGREES_PER_SIGN + DEGREES_PER_SIGN / 2;
      return {
        at: project(middle, ascendant, SIGN_GLYPH_RADIUS_PX),
        text: sign.glyph,
        className: `wheel-sign-glyph wheel-sign-glyph--${sign.element}`,
      };
    }),
  );
}

function measureTicks(ascendant: number): Segment[] {
  return Array.from({ length: DEGREES_PER_CIRCLE }, (_, degree) => {
    const isMajor = degree % MAJOR_TICK_INTERVAL_DEGREES === 0;
    const length = isMajor ? MAJOR_TICK_LENGTH_PX : MINOR_TICK_LENGTH_PX;

    return {
      from: project(degree, ascendant, ZODIAC_INNER_RADIUS_PX),
      to: project(degree, ascendant, ZODIAC_INNER_RADIUS_PX - length),
      className: "wheel-tick",
    };
  });
}

function drawHouses(parent: Parent, chart: Chart): void {
  const { cusps, ascendant } = chart.houses;

  joinLines(
    parent,
    cusps.map((cusp) => ({
      from: project(cusp, ascendant, ZODIAC_INNER_RADIUS_PX),
      to: project(cusp, ascendant, ASPECT_RADIUS_PX),
      className: "wheel-cusp",
    })),
  );

  joinLabels(
    parent,
    cusps.map((cusp, index) => {
      const next = cusps[(index + 1) % HOUSE_COUNT];
      const middle = cusp + normalizeDegrees(next - cusp) / 2;

      return {
        at: project(middle, ascendant, HOUSE_NUMBER_RADIUS_PX),
        text: String(index + 1),
        className: "wheel-house-number",
      };
    }),
  );
}

/** The four angles get heavier axes, drawn right across the wheel. */
function drawAxes(parent: Parent, chart: Chart): void {
  const { ascendant, midheaven } = chart.houses;
  const axes = [
    { longitude: ascendant, label: "AC" },
    { longitude: ascendant + 180, label: "DC" },
    { longitude: midheaven, label: "MC" },
    { longitude: midheaven + 180, label: "IC" },
  ];

  joinLines(
    parent,
    axes.map((axis) => ({
      from: project(axis.longitude, ascendant, ZODIAC_INNER_RADIUS_PX),
      to: project(axis.longitude, ascendant, ASPECT_RADIUS_PX),
      className: "wheel-axis",
    })),
  );

  joinLabels(
    parent,
    axes.map((axis) => ({
      at: project(
        axis.longitude + ANGLE_LABEL_OFFSET_DEGREES,
        ascendant,
        ANGLE_LABEL_RADIUS_PX,
      ),
      text: axis.label,
      className: "wheel-axis-label",
    })),
  );
}

/**
 * Spreads crowded bodies apart so each glyph gets its own slot, while
 * keeping them as close to their true longitudes as possible. Returns
 * display longitudes in the same order as the input.
 *
 * Example: Sun 10°, Mercury 12° → displayed at about 7° and 15°.
 */
export function spreadLongitudes(longitudes: number[]): number[] {
  const order = longitudes
    .map((longitude, index) => ({ longitude, index }))
    .sort((a, b) => a.longitude - b.longitude);
  const display = order.map((item) => item.longitude);
  const count = display.length;

  if (count < 2) {
    return [...longitudes];
  }

  for (let iteration = 0; iteration < SPREAD_ITERATIONS; iteration++) {
    let isSettled = true;

    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      const gap = normalizeDegrees(display[next] - display[i]);

      if (gap >= MIN_GLYPH_SEPARATION_DEGREES) {
        continue;
      }

      const push = (MIN_GLYPH_SEPARATION_DEGREES - gap) / 2;
      display[i] -= push;
      display[next] += push;
      isSettled = false;
    }

    if (isSettled) {
      break;
    }
  }

  const result = new Array<number>(count);
  order.forEach((item, sortedIndex) => {
    result[item.index] = normalizeDegrees(display[sortedIndex]);
  });
  return result;
}

function measureBody(
  body: PlacedBody,
  displayLongitude: number,
  ascendant: number,
): BodyMark {
  const info = BODY_INFO[body.body];
  const degreeInSign = Math.floor(
    normalizeDegrees(body.longitude) % DEGREES_PER_SIGN,
  );
  const pointerEnd = project(
    body.longitude,
    ascendant,
    ZODIAC_INNER_RADIUS_PX - BODY_POINTER_LENGTH_PX,
  );

  const labels: Label[] = [
    {
      at: project(displayLongitude, ascendant, BODY_GLYPH_RADIUS_PX),
      text: info.glyph,
      className: "wheel-body-glyph",
    },
    {
      at: project(displayLongitude, ascendant, BODY_DEGREE_RADIUS_PX),
      text: `${degreeInSign}°`,
      className: "wheel-body-degree",
    },
  ];

  if (body.isRetrograde) {
    labels.push({
      at: project(displayLongitude, ascendant, BODY_RETROGRADE_RADIUS_PX),
      text: "℞",
      className: "wheel-body-retrograde",
    });
  }

  return {
    key: body.body,
    name: info.name,
    segments: [
      {
        from: project(body.longitude, ascendant, ZODIAC_INNER_RADIUS_PX),
        to: pointerEnd,
        className: "wheel-body-pointer",
      },
      {
        from: pointerEnd,
        to: project(
          displayLongitude,
          ascendant,
          BODY_GLYPH_RADIUS_PX + BODY_LEADER_GAP_PX,
        ),
        className: "wheel-body-leader",
      },
    ],
    labels,
  };
}

function drawBodies(parent: Parent, chart: Chart): void {
  const { ascendant } = chart.houses;
  const display = spreadLongitudes(chart.bodies.map((b) => b.longitude));
  const marks = chart.bodies.map((body, index) =>
    measureBody(body, display[index], ascendant),
  );

  // Keyed by body so each <g> follows its body across redraws.
  parent
    .selectAll<SVGGElement, BodyMark>("g.wheel-body")
    .data(marks, (d) => d.key)
    .join("g")
    .attr("class", "wheel-body")
    .each(function (mark) {
      const group: Parent = select(this);
      group
        .selectAll("title")
        .data([mark.name])
        .join("title")
        .text((d) => d);
      joinLines(group, mark.segments);
      joinLabels(group, mark.labels);
    });
}

function measureAspects(chart: Chart): Segment[] {
  const { ascendant } = chart.houses;
  const longitudes = new Map(
    chart.bodies.map((body) => [body.body, body.longitude]),
  );

  return chart.aspects
    .filter((aspect) => ASPECT_INFO[aspect.type].angleDegrees > 0)
    .map((aspect) => ({
      from: project(longitudes.get(aspect.first)!, ascendant, ASPECT_RADIUS_PX),
      to: project(longitudes.get(aspect.second)!, ascendant, ASPECT_RADIUS_PX),
      className: `wheel-aspect wheel-aspect--${ASPECT_INFO[aspect.type].quality}`,
    }));
}

function selectLayer(svg: Parent, layer: Layer): Parent {
  return svg
    .selectAll<SVGGElement, Layer>(`g.wheel-layer--${layer}`)
    .data([layer])
    .join("g")
    .attr("class", `wheel-layer wheel-layer--${layer}`);
}

/**
 * Draws the full chart wheel into an <svg>. Safe to call again with a
 * new chart: existing elements are updated rather than duplicated.
 */
export function drawWheel(element: SVGSVGElement, chart: Chart): void {
  const { ascendant } = chart.houses;
  const svg: Parent = select(element);

  svg
    .attr("viewBox", `0 0 ${WHEEL_SIZE_PX} ${WHEEL_SIZE_PX}`)
    .attr("class", "wheel")
    .attr("role", "img")
    .attr("aria-labelledby", WHEEL_TITLE_ID);

  // :scope keeps this from matching the bodies' own <title> elements.
  svg
    .selectAll(":scope > title")
    .data(["Natal chart wheel"])
    .join("title")
    .attr("id", WHEEL_TITLE_ID)
    .text((d) => d);

  // Create every layer up front so paint order is fixed on first draw.
  const layers = Object.fromEntries(
    LAYERS.map((layer) => [layer, selectLayer(svg, layer)]),
  ) as Record<Layer, Parent>;

  joinRings(layers["outer-ring"], [
    { radius: ZODIAC_OUTER_RADIUS_PX, className: "wheel-ring" },
  ]);
  drawSigns(layers.signs, ascendant);
  joinLines(layers.ticks, measureTicks(ascendant));
  joinRings(layers.rings, [
    { radius: ZODIAC_INNER_RADIUS_PX, className: "wheel-ring" },
    { radius: HOUSE_RING_RADIUS_PX, className: "wheel-ring wheel-ring--faint" },
    { radius: ASPECT_RADIUS_PX, className: "wheel-ring" },
  ]);
  drawHouses(layers.houses, chart);
  drawAxes(layers.axes, chart);
  joinLines(layers.aspects, measureAspects(chart));
  drawBodies(layers.bodies, chart);
}
