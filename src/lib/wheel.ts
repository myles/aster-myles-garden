// Renders a chart as an SVG wheel with D3. Geometry is computed as plain
// data first, then joined to the DOM, so redrawing a chart updates the
// existing elements in place. Colours come from CSS classes.
//
// A bi-wheel sets a chart inside the zodiac as usual against a second
// set of bodies on a ring outside it, such as another person's chart or
// the sky today, with the aspects between the two across the centre.

import { select, type Selection } from "d3-selection";
import { arc } from "d3-shape";

import type { Chart, PlacedBody } from "@/lib/chart";
import type { HousePositions } from "@/lib/ephemeris";

import { ASPECT_INFO, type Aspect } from "@/lib/aspects";
import { BODY_INFO } from "@/lib/bodies";
import { describeBiWheel, describeWheel } from "@/lib/describe";
import { HOUSE_COUNT } from "@/lib/houses";
import {
  DEGREES_PER_CIRCLE,
  DEGREES_PER_SIGN,
  normalizeDegrees,
  SIGNS,
} from "@/lib/zodiac";

const WHEEL_SIZE_PX = 600;
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
const ANGLE_LABEL_RADIUS_PX = 159;
const ANGLE_LABEL_OFFSET_DEGREES = 4;

// The bi-wheel's outer ring, outside the zodiac. Its viewBox grows by a
// margin on every side so the inner wheel's geometry stays the same.
const OUTER_BODY_GLYPH_RADIUS_PX = 322;
const OUTER_BODY_DEGREE_RADIUS_PX = 348;
const OUTER_BODY_RETROGRADE_RADIUS_PX = 364;
const OUTER_RING_RADIUS_PX = 378;
const BI_WHEEL_MARGIN_PX = 90;

const MAJOR_TICK_INTERVAL_DEGREES = 5;

/** Where a natal chart without an ascendant starts: 0° Aries. */
const NATURAL_WHEEL_START_DEGREES = 0;

/** Bodies closer than this are fanned out so their glyphs don't overlap. */
const MIN_GLYPH_SEPARATION_DEGREES = 8;
const SPREAD_ITERATIONS = 60;

const COORDINATE_DECIMALS = 2;

const WHEEL_TITLE_ID = "wheel-title";
const WHEEL_DESCRIPTION_ID = "wheel-description";
const WHEEL_TITLE = "Natal chart wheel";

/** What a single wheel draws: a natal chart, or a composite. */
export type WheelChart = Pick<Chart, "bodies" | "houses" | "aspects">;

/** What a bi-wheel draws. */
export type BiWheel = {
  /** Drawn inside the zodiac, in its own houses. */
  inner: Chart;
  /** Drawn on the ring outside the zodiac. */
  outerBodies: PlacedBody[];
  /** Each aspect's first body is inner, its second outer. */
  aspects: Aspect[];
  /** The wheel's accessible name, e.g. "Chart comparison wheel". */
  title: string;
  /** Whose the inner planets are, e.g. "Your" or "Your natal". */
  innerLabel: string;
  /** Whose the outer planets are, e.g. "Their" → "Their Venus". */
  outerLabel: string;
};

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
  "outer-bodies",
] as const;

type Layer = (typeof LAYERS)[number];

type Point = { x: number; y: number };
type Segment = { from: Point; to: Point; className: string };
type Label = {
  at: Point;
  text: string;
  className: string;
  textAnchor?: "start" | "middle" | "end";
};
type Ring = { radius: number; className: string };

/** Where a chart's bodies sit: inside the zodiac, or outside it. */
type BodyRing = {
  /** The zodiac edge each body's pointer starts from. */
  edgeRadius: number;
  pointerEndRadius: number;
  glyphRadius: number;
  /** Where the leader from the pointer stops, just short of the glyph. */
  leaderEndRadius: number;
  degreeRadius: number;
  retrogradeRadius: number;
  className: string;
  /** Prefixed to each body's tooltip, e.g. "Their " → "Their Venus". */
  titlePrefix: string;
};

const INNER_BODY_RING: BodyRing = {
  edgeRadius: ZODIAC_INNER_RADIUS_PX,
  pointerEndRadius: ZODIAC_INNER_RADIUS_PX - BODY_POINTER_LENGTH_PX,
  glyphRadius: BODY_GLYPH_RADIUS_PX,
  leaderEndRadius: BODY_GLYPH_RADIUS_PX + BODY_LEADER_GAP_PX,
  degreeRadius: BODY_DEGREE_RADIUS_PX,
  retrogradeRadius: BODY_RETROGRADE_RADIUS_PX,
  className: "wheel-body",
  titlePrefix: "",
};

const OUTER_BODY_RING: BodyRing = {
  edgeRadius: ZODIAC_OUTER_RADIUS_PX,
  pointerEndRadius: ZODIAC_OUTER_RADIUS_PX + BODY_POINTER_LENGTH_PX,
  glyphRadius: OUTER_BODY_GLYPH_RADIUS_PX,
  leaderEndRadius: OUTER_BODY_GLYPH_RADIUS_PX - BODY_LEADER_GAP_PX,
  degreeRadius: OUTER_BODY_DEGREE_RADIUS_PX,
  retrogradeRadius: OUTER_BODY_RETROGRADE_RADIUS_PX,
  className: "wheel-body wheel-body--outer",
  // Set per bi-wheel, from BiWheel.outerLabel.
  titlePrefix: "",
};

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
    .attr("text-anchor", (d) => d.textAnchor ?? "middle")
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

/** Without houses, clears any a previous chart left behind. */
function clearMarks(parent: Parent): void {
  joinLines(parent, []);
  joinLabels(parent, []);
}

function drawHouses(parent: Parent, houses: HousePositions | undefined): void {
  if (!houses) {
    clearMarks(parent);
    return;
  }

  const { cusps, ascendant } = houses;

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
function drawAxes(parent: Parent, houses: HousePositions | undefined): void {
  if (!houses) {
    clearMarks(parent);
    return;
  }

  const { ascendant, midheaven } = houses;
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
    axes.map((axis) => {
      const at = project(
        axis.longitude + ANGLE_LABEL_OFFSET_DEGREES,
        ascendant,
        ANGLE_LABEL_RADIUS_PX,
      );

      // Keep the text towards the centre, inside the bodies' annotation
      // ring, even when a retrograde body sits directly on an angle.
      return {
        at,
        text: axis.label,
        className: "wheel-axis-label",
        textAnchor: at.x < CENTRE_PX ? "start" : "end",
      };
    }),
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
    .toSorted((a, b) => a.longitude - b.longitude);
  const display = order.map((item) => item.longitude);
  const count = display.length;

  if (count < 2) {
    return [...longitudes];
  }

  for (let iteration = 0; iteration < SPREAD_ITERATIONS; iteration++) {
    let isSettled = true;

    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      // Measured directly, so a pair pushed past each other shows a
      // negative gap rather than one of nearly 360°. Only the last body
      // and the first are measured round the circle.
      const gap =
        next === 0
          ? display[0] + DEGREES_PER_CIRCLE - display[i]
          : display[next] - display[i];

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

  const result = Array.from<number>({ length: count });
  order.forEach((item, sortedIndex) => {
    result[item.index] = normalizeDegrees(display[sortedIndex]);
  });
  return result;
}

function measureBody(
  body: PlacedBody,
  displayLongitude: number,
  ascendant: number,
  ring: BodyRing,
): BodyMark {
  const info = BODY_INFO[body.body];
  const degreeInSign = Math.floor(
    normalizeDegrees(body.longitude) % DEGREES_PER_SIGN,
  );
  const pointerEnd = project(body.longitude, ascendant, ring.pointerEndRadius);

  const labels: Label[] = [
    {
      at: project(displayLongitude, ascendant, ring.glyphRadius),
      text: info.glyph,
      className: "wheel-body-glyph",
    },
    {
      at: project(displayLongitude, ascendant, ring.degreeRadius),
      text: `${degreeInSign}°`,
      className: "wheel-body-degree",
    },
  ];

  if (body.isRetrograde) {
    labels.push({
      at: project(displayLongitude, ascendant, ring.retrogradeRadius),
      text: "℞",
      className: "wheel-body-retrograde",
    });
  }

  return {
    key: body.body,
    name: ring.titlePrefix + info.name,
    segments: [
      {
        from: project(body.longitude, ascendant, ring.edgeRadius),
        to: pointerEnd,
        className: "wheel-body-pointer",
      },
      {
        from: pointerEnd,
        to: project(displayLongitude, ascendant, ring.leaderEndRadius),
        className: "wheel-body-leader",
      },
    ],
    labels,
  };
}

function drawBodies(
  parent: Parent,
  bodies: PlacedBody[],
  ascendant: number,
  ring: BodyRing,
): void {
  const display = spreadLongitudes(bodies.map((b) => b.longitude));
  const marks = bodies.map((body, index) =>
    measureBody(body, display[index], ascendant, ring),
  );

  // Keyed by body so each <g> follows its body across redraws.
  parent
    .selectAll<SVGGElement, BodyMark>("g.wheel-body")
    .data(marks, (d) => d.key)
    .join("g")
    .attr("class", ring.className)
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

/**
 * Lines across the centre for each aspect. An aspect's first body is
 * looked up in `firstBodies` and its second in `secondBodies`, which are
 * the same list on a single chart and different charts on a bi-wheel.
 */
function measureAspects(
  aspects: Aspect[],
  firstBodies: PlacedBody[],
  secondBodies: PlacedBody[],
  ascendant: number,
): Segment[] {
  const firstLongitudes = toLongitudes(firstBodies);
  const secondLongitudes = toLongitudes(secondBodies);

  return aspects
    .filter((aspect) => ASPECT_INFO[aspect.type].angleDegrees > 0)
    .map((aspect) => {
      const { quality, rank } = ASPECT_INFO[aspect.type];

      return {
        from: project(
          firstLongitudes.get(aspect.first)!,
          ascendant,
          ASPECT_RADIUS_PX,
        ),
        to: project(
          secondLongitudes.get(aspect.second)!,
          ascendant,
          ASPECT_RADIUS_PX,
        ),
        className: [
          "wheel-aspect",
          `wheel-aspect--${quality}`,
          `wheel-aspect--${rank}`,
        ].join(" "),
      };
    });
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
 * `title` is its accessible name.
 */
export function drawWheel(
  element: SVGSVGElement,
  chart: WheelChart,
  title = WHEEL_TITLE,
): void {
  render(element, chart, undefined, title);
}

/**
 * Draws a bi-wheel: a chart inside, in its own houses, and more bodies on
 * an outer ring, with the aspects between them across the centre. Safe to
 * call on an <svg> that held either kind of wheel.
 */
export function drawBiWheel(element: SVGSVGElement, biWheel: BiWheel): void {
  render(element, biWheel.inner, biWheel, biWheel.title);
}

function render(
  element: SVGSVGElement,
  chart: WheelChart,
  biWheel: BiWheel | undefined,
  title: string,
): void {
  // Without a birth time there's no ascendant, so the wheel starts at
  // 0° Aries instead, as a natural chart does.
  const ascendant = chart.houses?.ascendant ?? NATURAL_WHEEL_START_DEGREES;
  const margin = biWheel ? BI_WHEEL_MARGIN_PX : 0;
  const size = WHEEL_SIZE_PX + margin * 2;
  const svg: Parent = select(element);

  svg
    .attr("viewBox", `${-margin} ${-margin} ${size} ${size}`)
    .attr("class", "wheel")
    .attr("role", "img")
    .attr("aria-labelledby", WHEEL_TITLE_ID)
    .attr("aria-describedby", WHEEL_DESCRIPTION_ID);

  // :scope keeps this from matching the bodies' own <title> elements.
  svg
    .selectAll(":scope > title")
    .data([title])
    .join("title")
    .attr("id", WHEEL_TITLE_ID)
    .text((d) => d);

  // Read out after the title, and kept in exported files.
  const description = biWheel ? describeBiWheel(biWheel) : describeWheel(chart);
  svg
    .selectAll(":scope > desc")
    .data([description.join(" ")])
    .join("desc")
    .attr("id", WHEEL_DESCRIPTION_ID)
    .text((d) => d);

  // Create every layer up front so paint order is fixed on first draw.
  const layers = Object.fromEntries(
    LAYERS.map((layer) => [layer, selectLayer(svg, layer)]),
  ) as Record<Layer, Parent>;

  const outerRings: Ring[] = biWheel
    ? [
        {
          radius: OUTER_RING_RADIUS_PX,
          className: "wheel-ring wheel-ring--faint",
        },
      ]
    : [];

  joinRings(layers["outer-ring"], [
    ...outerRings,
    { radius: ZODIAC_OUTER_RADIUS_PX, className: "wheel-ring" },
  ]);
  drawSigns(layers.signs, ascendant);
  joinLines(layers.ticks, measureTicks(ascendant));
  joinRings(layers.rings, [
    { radius: ZODIAC_INNER_RADIUS_PX, className: "wheel-ring" },
    { radius: HOUSE_RING_RADIUS_PX, className: "wheel-ring wheel-ring--faint" },
    { radius: ASPECT_RADIUS_PX, className: "wheel-ring" },
  ]);
  drawHouses(layers.houses, chart.houses);
  drawAxes(layers.axes, chart.houses);
  joinLines(
    layers.aspects,
    biWheel
      ? measureAspects(
          biWheel.aspects,
          chart.bodies,
          biWheel.outerBodies,
          ascendant,
        )
      : measureAspects(chart.aspects, chart.bodies, chart.bodies, ascendant),
  );
  drawBodies(layers.bodies, chart.bodies, ascendant, INNER_BODY_RING);
  drawBodies(layers["outer-bodies"], biWheel?.outerBodies ?? [], ascendant, {
    ...OUTER_BODY_RING,
    titlePrefix: biWheel ? `${biWheel.outerLabel} ` : "",
  });
}

const toLongitudes = (bodies: PlacedBody[]) =>
  new Map(bodies.map((body) => [body.body, body.longitude]));
