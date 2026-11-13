import type { BodyPosition } from "@/lib/ephemeris";

import { Body, BODY_INFO, BodyKind } from "@/lib/bodies";
import { separateDegrees } from "@/lib/zodiac";

export enum AspectType {
  Conjunction = "conjunction",
  Sextile = "sextile",
  Square = "square",
  Trine = "trine",
  Opposition = "opposition",
}

export enum AspectQuality {
  Neutral = "neutral",
  Harmonious = "harmonious",
  Challenging = "challenging",
}

type AspectInfo = {
  name: string;
  glyph: string;
  angleDegrees: number;
  orbDegrees: number;
  quality: AspectQuality;
};

// Orbs follow common modern practice; wider for the stronger aspects.
export const ASPECT_INFO: Record<AspectType, AspectInfo> = {
  [AspectType.Conjunction]: {
    name: "Conjunction",
    glyph: "☌︎",
    angleDegrees: 0,
    orbDegrees: 8,
    quality: AspectQuality.Neutral,
  },
  [AspectType.Sextile]: {
    name: "Sextile",
    glyph: "⚹︎",
    angleDegrees: 60,
    orbDegrees: 4,
    quality: AspectQuality.Harmonious,
  },
  [AspectType.Square]: {
    name: "Square",
    glyph: "□︎",
    angleDegrees: 90,
    orbDegrees: 7,
    quality: AspectQuality.Challenging,
  },
  [AspectType.Trine]: {
    name: "Trine",
    glyph: "△︎",
    angleDegrees: 120,
    orbDegrees: 7,
    quality: AspectQuality.Harmonious,
  },
  [AspectType.Opposition]: {
    name: "Opposition",
    glyph: "☍︎",
    angleDegrees: 180,
    orbDegrees: 8,
    quality: AspectQuality.Challenging,
  },
};

export type Aspect = {
  first: Body;
  second: Body;
  type: AspectType;
  /** How far the separation is from exact, in degrees. */
  orbDegrees: number;
};

type AspectMatch = Pick<Aspect, "type" | "orbDegrees">;

function matchAspect(
  separation: number,
  maxOrbDegrees = Infinity,
): AspectMatch | undefined {
  for (const type of Object.values(AspectType)) {
    const info = ASPECT_INFO[type];
    const orbDegrees = Math.abs(separation - info.angleDegrees);

    if (orbDegrees <= Math.min(info.orbDegrees, maxOrbDegrees)) {
      return { type, orbDegrees };
    }
  }

  return undefined;
}

/**
 * Finds the major aspects between planets, tightest first. Points such as
 * the lunar node are left out to keep the wheel readable.
 */
export function findAspects(positions: BodyPosition[]): Aspect[] {
  const planets = selectPlanets(positions);
  const aspects: Aspect[] = [];

  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const separation = separateDegrees(
        planets[i].longitude,
        planets[j].longitude,
      );
      const match = matchAspect(separation);

      if (!match) {
        continue;
      }

      aspects.push({
        first: planets[i].body,
        second: planets[j].body,
        ...match,
      });
    }
  }

  return aspects.sort((a, b) => a.orbDegrees - b.orbDegrees);
}

/**
 * Finds the major aspects between two charts' planets, tightest first.
 * Each aspect's first body comes from `firstChart` and its second from
 * `secondChart`, so a body can aspect its own counterpart (Sun–Sun).
 * `maxOrbDegrees` narrows every aspect's orb, as transits use.
 */
export function findAspectsBetween(
  firstChart: BodyPosition[],
  secondChart: BodyPosition[],
  maxOrbDegrees?: number,
): Aspect[] {
  const aspects: Aspect[] = [];

  for (const first of selectPlanets(firstChart)) {
    for (const second of selectPlanets(secondChart)) {
      const match = matchAspect(
        separateDegrees(first.longitude, second.longitude),
        maxOrbDegrees,
      );

      if (!match) {
        continue;
      }

      aspects.push({ first: first.body, second: second.body, ...match });
    }
  }

  return aspects.sort((a, b) => a.orbDegrees - b.orbDegrees);
}

/** Points such as the lunar node are left out to keep the wheel readable. */
function selectPlanets(positions: BodyPosition[]): BodyPosition[] {
  return positions.filter(
    (position) => BODY_INFO[position.body].kind === BodyKind.Planet,
  );
}
