// A small, hand-built chart: two bodies in opposition, Equal houses.

import type { Chart } from "@/lib/charts/chart";
import type { Composite } from "@/lib/charts/composite";
import type { LunarReturn } from "@/lib/charts/lunar-return";
import type { Progressions } from "@/lib/charts/progressions";
import type { SolarReturn } from "@/lib/charts/solar-return";
import type { Transits } from "@/lib/charts/transits";

import { AspectType } from "@/lib/astrology/aspects";
import { Body } from "@/lib/astrology/bodies";
import { HouseSystem } from "@/lib/astrology/houses";
import { SIGNS } from "@/lib/astrology/zodiac";

export const CHART: Chart = {
  details: {
    date: { year: 2000, month: 1, day: 1 },
    time: { hour: 12, minute: 0 },
    place: {
      id: 2643743,
      name: "London",
      region: "England",
      country: "United Kingdom",
      latitude: 51.5,
      longitude: -0.12,
      timeZone: "Europe/London",
    },
    houseSystem: HouseSystem.Equal,
  },
  bornAt: new Date("2000-01-01T12:00:00Z"),
  julianDay: 2_451_545,
  bodies: [
    {
      body: Body.Sun,
      longitude: 280,
      latitude: 0,
      speed: 1,
      house: 10,
      isRetrograde: false,
    },
    {
      body: Body.Mars,
      longitude: 100,
      latitude: 0,
      speed: -0.2,
      house: 4,
      isRetrograde: true,
    },
  ],
  houses: {
    cusps: Array.from({ length: 12 }, (_, i) => i * 30),
    ascendant: 0,
    midheaven: 270,
    houseSystem: HouseSystem.Equal,
  },
  aspects: [
    {
      first: Body.Sun,
      second: Body.Mars,
      type: AspectType.Opposition,
      orbDegrees: 0,
    },
  ],
};

const [, , , CANCER, LEO, , , , , CAPRICORN] = SIGNS;

/** The same chart with the birth time unknown. Mars might be in Leo. */
export const CHART_WITHOUT_TIME: Chart = {
  ...CHART,
  details: { ...CHART.details, time: undefined },
  houses: undefined,
  bodies: CHART.bodies.map((placed) => ({
    ...placed,
    house: undefined,
    possibleSigns: placed.body === Body.Mars ? [CANCER, LEO] : [CAPRICORN],
  })),
};

/**
 * CHART asking for Placidus houses in Tromsø, inside the Arctic Circle,
 * where they can't be cast: its houses fell back to Porphyry.
 */
export const POLAR_CHART: Chart = {
  ...CHART,
  details: {
    ...CHART.details,
    place: {
      id: 3133880,
      name: "Tromsø",
      region: "Troms",
      country: "Norway",
      latitude: 69.6496,
      longitude: 18.957,
      timeZone: "Europe/Oslo",
    },
    houseSystem: HouseSystem.Placidus,
  },
  houses: { ...CHART.houses!, houseSystem: HouseSystem.Porphyry },
};

/** The sky against CHART: a transiting Sun at 190°, squaring natal Mars. */
export const TRANSITS: Transits = {
  natal: CHART,
  at: new Date("2026-11-13T20:05:00Z"),
  bodies: [{ ...CHART.bodies[0], longitude: 190, house: undefined }],
  aspects: [
    {
      first: Body.Mars,
      second: Body.Sun,
      type: AspectType.Square,
      orbDegrees: 1.5,
      timing: {
        entersOrb: new Date("2026-11-11T16:00:00Z"),
        exact: [new Date("2026-11-15T09:30:00Z")],
        leavesOrb: new Date("2026-11-17T04:00:00Z"),
      },
    },
  ],
  inNatalHouses: { [Body.Sun]: 7 },
};

/**
 * CHART progressed to 14 November 2026: a progressed Sun at 310.5°, half
 * a degree from a quincunx to natal Mars at 100°.
 */
export const PROGRESSIONS: Progressions = {
  natal: CHART,
  forDate: { year: 2026, month: 11, day: 14 },
  skyAt: new Date("2000-01-28T08:00:00Z"),
  bodies: [{ ...CHART.bodies[0], longitude: 310.5, house: undefined }],
  aspects: [
    {
      first: Body.Mars,
      second: Body.Sun,
      type: AspectType.Quincunx,
      orbDegrees: 0.5,
    },
  ],
  inNatalHouses: { [Body.Sun]: 11 },
};

/** Your chart with itself: every midpoint is the body's own position. */
export const COMPOSITE: Composite = {
  first: CHART,
  second: CHART,
  bodies: CHART.bodies.map((placed) => ({
    ...placed,
    speed: 0,
    isRetrograde: false,
  })),
  houses: CHART.houses,
  aspects: CHART.aspects,
};

/** Your chart standing in for its own return, which only the year marks. */
export const SOLAR_RETURN: SolarReturn = {
  natal: CHART,
  year: 2026,
  chart: CHART,
};

/**
 * Your chart standing in for its own lunar return, which only its date,
 * where it's cast, marks.
 */
export const LUNAR_RETURN: LunarReturn = {
  natal: CHART,
  chart: {
    ...CHART,
    details: {
      ...CHART.details,
      date: { year: 2026, month: 12, day: 3 },
      time: { hour: 9, minute: 41 },
    },
    bornAt: new Date("2026-12-03T09:41:00Z"),
  },
};
