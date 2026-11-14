// Describes a chart wheel in words, for people who can't see it. The
// tables already list every position and aspect, so this says what the
// wheel shows at a glance: which way round it sits, how the planets
// cluster around it, their balance, and the lines across the centre.

import type { Chart, PlacedBody } from "@/lib/chart";
import type { BiWheel, WheelChart } from "@/lib/wheel";

import { ASPECT_INFO, AspectQuality, type Aspect } from "@/lib/aspects";
import { BODY_INFO, BodyKind } from "@/lib/bodies";
import { formatLongitude, getSign, normalizeDegrees } from "@/lib/zodiac";

/** Matches the wheel: without an ascendant, 0° Aries sits on the left. */
const NATURAL_WHEEL_START_DEGREES = 0;

/** Houses 7 to 12 are the half of the wheel above the horizon. */
const FIRST_HOUSE_ABOVE_HORIZON = 7;

const ELEMENTS = ["fire", "earth", "air", "water"] as const;

/** A verb in both numbers, e.g. "crosses" for one line, "cross" for two. */
type LineVerb = { one: string; many: string };

const CROSSES_CENTRE: LineVerb = {
  one: "crosses the centre",
  many: "cross the centre",
};
const LINKS_RINGS: LineVerb = {
  one: "links the two rings",
  many: "link the two rings",
};

/** One sentence per entry, in reading order. */
export function describeWheel(chart: WheelChart): string[] {
  const ascendant = chart.houses?.ascendant ?? NATURAL_WHEEL_START_DEGREES;
  const ring = describeRing(chart.bodies, ascendant);
  const sentences = [
    describeOrientation(chart),
    `Going anticlockwise from the left — ${ring}.`,
    describeElements(chart.bodies),
  ];

  if (chart.houses) {
    sentences.push(describeHorizon(chart.bodies));
  }

  sentences.push(describeLines(chart.aspects, CROSSES_CENTRE));
  return sentences;
}

/** One sentence per entry, in reading order. */
export function describeBiWheel(biWheel: BiWheel): string[] {
  const { inner } = biWheel;
  const ascendant = inner.houses?.ascendant ?? NATURAL_WHEEL_START_DEGREES;
  const innerLabel = biWheel.innerLabel.toLowerCase();
  const outerLabel = biWheel.outerLabel.toLowerCase();
  // Only the inner chart's houses are drawn, so outer bodies' own house
  // numbers would mislead.
  const outerBodies = biWheel.outerBodies.map((placed) => ({
    ...placed,
    house: undefined,
  }));

  return [
    describeOrientation(inner),
    `Inside, ${innerLabel} planets, going anticlockwise from the left — ` +
      `${describeRing(inner.bodies, ascendant)}.`,
    `Outside, ${outerLabel} planets — ` +
      `${describeRing(outerBodies, ascendant)}.`,
    describeLines(biWheel.aspects, LINKS_RINGS),
  ];
}

function describeOrientation(chart: Pick<Chart, "houses">): string {
  if (!chart.houses) {
    return (
      "There's no birth time, so no houses or angles; " +
      "0° Aries is on the left."
    );
  }

  const ascendant = formatLongitude(chart.houses.ascendant);
  const midheaven = formatLongitude(chart.houses.midheaven);

  return (
    `The ascendant, ${ascendant}, is on the left, and the midheaven, ` +
    `${midheaven}, is towards the top.`
  );
}

/**
 * The bodies in the order they sit going anticlockwise from the left,
 * grouped by sign so clusters stand out.
 * Example: "Cancer: Mars (house 4); Capricorn: Sun (house 10), Moon".
 */
function describeRing(bodies: PlacedBody[], ascendant: number): string {
  const ordered = [...bodies].sort(
    (a, b) =>
      normalizeDegrees(a.longitude - ascendant) -
      normalizeDegrees(b.longitude - ascendant),
  );
  const groups: { signName: string; bodies: string[] }[] = [];

  for (const placed of ordered) {
    const signName = getSign(placed.longitude).name;
    const last = groups.at(-1);

    if (last?.signName === signName) {
      last.bodies.push(describeBody(placed));
      continue;
    }

    groups.push({ signName, bodies: [describeBody(placed)] });
  }

  return groups
    .map((group) => `${group.signName}: ${group.bodies.join(", ")}`)
    .join("; ");
}

/** Example: "Mars (house 4, retrograde, may be in Leo)". */
function describeBody(placed: PlacedBody): string {
  const sign = getSign(placed.longitude);
  const otherSign = placed.possibleSigns?.find(
    (candidate) => candidate !== sign,
  );
  const notes: string[] = [];

  if (placed.house !== undefined) {
    notes.push(`house ${placed.house}`);
  }
  if (placed.isRetrograde) {
    notes.push("retrograde");
  }
  if (otherSign) {
    notes.push(`may be in ${otherSign.name}`);
  }

  const name = BODY_INFO[placed.body].name;
  return notes.length > 0 ? `${name} (${notes.join(", ")})` : name;
}

function describeElements(bodies: PlacedBody[]): string {
  const signs = selectPlanets(bodies).map((placed) =>
    getSign(placed.longitude),
  );
  const counts = ELEMENTS.map((element) => ({
    element,
    count: signs.filter((sign) => sign.element === element).length,
  })).filter(({ count }) => count > 0);

  return (
    "Planets by element: " +
    counts.map(({ element, count }) => `${count} ${element}`).join(", ") +
    "."
  );
}

function describeHorizon(bodies: PlacedBody[]): string {
  const planets = selectPlanets(bodies);
  const above = planets.filter(
    (placed) => (placed.house ?? 0) >= FIRST_HOUSE_ABOVE_HORIZON,
  ).length;
  const below = planets.length - above;
  const subject = above === 1 ? "1 planet is" : `${above} planets are`;

  return `${subject} above the horizon and ${below} below.`;
}

/** Conjunctions aren't drawn as lines, so they aren't counted here. */
function describeLines(aspects: Aspect[], verb: LineVerb): string {
  const lines = aspects.filter(
    (aspect) => ASPECT_INFO[aspect.type].angleDegrees > 0,
  );

  if (lines.length === 0) {
    return `No aspect lines ${verb.many}.`;
  }

  const countOf = (quality: AspectQuality) =>
    lines.filter((aspect) => ASPECT_INFO[aspect.type].quality === quality)
      .length;
  const parts = [
    { count: countOf(AspectQuality.Harmonious), label: "harmonious" },
    { count: countOf(AspectQuality.Challenging), label: "challenging" },
  ]
    .filter(({ count }) => count > 0)
    .map(({ count, label }) => `${count} ${label}`);

  const subject =
    lines.length === 1
      ? `1 aspect line ${verb.one}`
      : `${lines.length} aspect lines ${verb.many}`;

  return `${subject}: ${parts.join(" and ")}.`;
}

/** Points such as the lunar node are left out of the balance. */
function selectPlanets(bodies: PlacedBody[]): PlacedBody[] {
  return bodies.filter(
    (placed) => BODY_INFO[placed.body].kind === BodyKind.Planet,
  );
}
