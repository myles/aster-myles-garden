// A small, hand-built chart: two bodies in opposition, Equal houses.

import { AspectType } from "@/lib/aspects";
import { Body } from "@/lib/bodies";
import type { Chart } from "@/lib/chart";
import { HouseSystem } from "@/lib/houses";

export const CHART: Chart = {
  details: {
    local: { year: 2000, month: 1, day: 1, hour: 12, minute: 0 },
    place: {
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
