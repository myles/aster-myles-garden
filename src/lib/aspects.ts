import type { BodyPosition } from "@/lib/ephemeris";

import { Body, BODY_INFO, BodyKind } from "@/lib/bodies";
import { separateDegrees } from "@/lib/zodiac";

export enum AspectType {
  Conjunction = "conjunction",
  Sextile = "sextile",
  Square = "square",
  Trine = "trine",
  Opposition = "opposition",
  SemiSextile = "semiSextile",
  SemiSquare = "semiSquare",
  Sesquiquadrate = "sesquiquadrate",
  Quincunx = "quincunx",
}

export enum AspectRank {
  Major = "major",
  Minor = "minor",
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
  rank: AspectRank;
};

const MINOR_ORB_DEGREES = 2;

// Orbs follow common modern practice; wider for the stronger aspects.
export const ASPECT_INFO: Record<AspectType, AspectInfo> = {
  [AspectType.Conjunction]: {
    name: "Conjunction",
    glyph: "☌︎",
    angleDegrees: 0,
    orbDegrees: 8,
    quality: AspectQuality.Neutral,
    rank: AspectRank.Major,
  },
  [AspectType.Sextile]: {
    name: "Sextile",
    glyph: "⚹︎",
    angleDegrees: 60,
    orbDegrees: 4,
    quality: AspectQuality.Harmonious,
    rank: AspectRank.Major,
  },
  [AspectType.Square]: {
    name: "Square",
    glyph: "□︎",
    angleDegrees: 90,
    orbDegrees: 7,
    quality: AspectQuality.Challenging,
    rank: AspectRank.Major,
  },
  [AspectType.Trine]: {
    name: "Trine",
    glyph: "△︎",
    angleDegrees: 120,
    orbDegrees: 7,
    quality: AspectQuality.Harmonious,
    rank: AspectRank.Major,
  },
  [AspectType.Opposition]: {
    name: "Opposition",
    glyph: "☍︎",
    angleDegrees: 180,
    orbDegrees: 8,
    quality: AspectQuality.Challenging,
    rank: AspectRank.Major,
  },
  [AspectType.SemiSextile]: {
    name: "Semi-sextile",
    glyph: "⚺︎",
    angleDegrees: 30,
    orbDegrees: MINOR_ORB_DEGREES,
    quality: AspectQuality.Harmonious,
    rank: AspectRank.Minor,
  },
  [AspectType.SemiSquare]: {
    name: "Semi-square",
    glyph: "∠︎",
    angleDegrees: 45,
    orbDegrees: MINOR_ORB_DEGREES,
    quality: AspectQuality.Challenging,
    rank: AspectRank.Minor,
  },
  [AspectType.Sesquiquadrate]: {
    name: "Sesquiquadrate",
    glyph: "⚼︎",
    angleDegrees: 135,
    orbDegrees: MINOR_ORB_DEGREES,
    quality: AspectQuality.Challenging,
    rank: AspectRank.Minor,
  },
  // The inconjunct: an awkward fit, so counted with the challenging ones.
  [AspectType.Quincunx]: {
    name: "Quincunx",
    glyph: "⚻︎",
    angleDegrees: 150,
    orbDegrees: MINOR_ORB_DEGREES,
    quality: AspectQuality.Challenging,
    rank: AspectRank.Minor,
  },
};

/** Which aspects to look for. */
export enum AspectSet {
  Major = "major",
  All = "all",
}

/** How generous every orb is, as a multiple of its standard width. */
export enum OrbSize {
  Tight = "tight",
  Standard = "standard",
  Wide = "wide",
}

export const ASPECT_SET_NAMES: Record<AspectSet, string> = {
  [AspectSet.Major]: "Major only",
  [AspectSet.All]: "With minor",
};

export const ORB_SIZE_NAMES: Record<OrbSize, string> = {
  [OrbSize.Tight]: "Tight",
  [OrbSize.Standard]: "Standard",
  [OrbSize.Wide]: "Wide",
};

const ORB_SCALES: Record<OrbSize, number> = {
  [OrbSize.Tight]: 0.75,
  [OrbSize.Standard]: 1,
  [OrbSize.Wide]: 1.25,
};

export type AspectSettings = {
  aspectSet: AspectSet;
  orbSize: OrbSize;
};

export const DEFAULT_ASPECT_SETTINGS: AspectSettings = {
  aspectSet: AspectSet.Major,
  orbSize: OrbSize.Standard,
};

export function isAspectSet(value: string): value is AspectSet {
  return Object.values(AspectSet).includes(value as AspectSet);
}

export function isOrbSize(value: string): value is OrbSize {
  return Object.values(OrbSize).includes(value as OrbSize);
}

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
  settings: AspectSettings,
  maxOrbDegrees = Infinity,
): AspectMatch | undefined {
  const scale = ORB_SCALES[settings.orbSize];

  for (const type of Object.values(AspectType)) {
    const info = ASPECT_INFO[type];
    if (
      info.rank === AspectRank.Minor &&
      settings.aspectSet !== AspectSet.All
    ) {
      continue;
    }

    const orbDegrees = Math.abs(separation - info.angleDegrees);
    if (orbDegrees <= Math.min(info.orbDegrees * scale, maxOrbDegrees)) {
      return { type, orbDegrees };
    }
  }

  return undefined;
}

/**
 * Finds the aspects between planets, tightest first: the major ones, and
 * the minor ones too when the settings ask. Points such as the lunar node
 * are left out to keep the wheel readable.
 */
export function findAspects(
  positions: BodyPosition[],
  settings = DEFAULT_ASPECT_SETTINGS,
): Aspect[] {
  const planets = selectPlanets(positions);
  const aspects: Aspect[] = [];

  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const separation = separateDegrees(
        planets[i].longitude,
        planets[j].longitude,
      );
      const match = matchAspect(separation, settings);

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

  return aspects.toSorted((a, b) => a.orbDegrees - b.orbDegrees);
}

/**
 * Finds the aspects between two charts' planets, tightest first. Each
 * aspect's first body comes from `firstChart` and its second from
 * `secondChart`, so a body can aspect its own counterpart (Sun–Sun).
 * `maxOrbDegrees` caps every aspect's orb, as transits use.
 */
export function findAspectsBetween(
  firstChart: BodyPosition[],
  secondChart: BodyPosition[],
  settings = DEFAULT_ASPECT_SETTINGS,
  maxOrbDegrees?: number,
): Aspect[] {
  const aspects: Aspect[] = [];

  for (const first of selectPlanets(firstChart)) {
    for (const second of selectPlanets(secondChart)) {
      const match = matchAspect(
        separateDegrees(first.longitude, second.longitude),
        settings,
        maxOrbDegrees,
      );

      if (!match) {
        continue;
      }

      aspects.push({ first: first.body, second: second.body, ...match });
    }
  }

  return aspects.toSorted((a, b) => a.orbDegrees - b.orbDegrees);
}

/** Points such as the lunar node are left out to keep the wheel readable. */
function selectPlanets(positions: BodyPosition[]): BodyPosition[] {
  return positions.filter(
    (position) => BODY_INFO[position.body].kind === BodyKind.Planet,
  );
}
