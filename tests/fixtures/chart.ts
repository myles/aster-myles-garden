// A small, hand-built chart: two bodies in opposition, Equal houses.

import type { Chart } from "@/lib/chart";
import type { Transits } from "@/lib/transits";

import { AspectType } from "@/lib/aspects";
import { Body } from "@/lib/bodies";
import { HouseSystem } from "@/lib/houses";
import { SIGNS } from "@/lib/zodiac";

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
    },
  ],
  inNatalHouses: { [Body.Sun]: 7 },
};
