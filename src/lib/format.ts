import type { Chart, PlacedBody } from "@/lib/charts/chart";
import type { LocalDate } from "@/lib/time";

import {
  AspectSet,
  DEFAULT_ASPECT_SETTINGS,
  type AspectSettings,
} from "@/lib/astrology/aspects";
import { formatLongitude, getSign } from "@/lib/astrology/zodiac";

const MINUTES_PER_DEGREE = 60;
const COORDINATE_DECIMALS = 2;

/**
 * The start of an empty aspect table's message: "No major aspects", or
 * "No aspects" once minor ones are looked for too.
 */
export function formatNoAspects(
  settings: AspectSettings = DEFAULT_ASPECT_SETTINGS,
): string {
  return settings.aspectSet === AspectSet.All
    ? "No aspects"
    : "No major aspects";
}

/**
 * Formats an angular amount as degrees and minutes.
 * Example: 2.5 → "2° 30′".
 */
export function formatDegrees(degrees: number): string {
  const totalMinutes = Math.round(Math.abs(degrees) * MINUTES_PER_DEGREE);
  const whole = Math.floor(totalMinutes / MINUTES_PER_DEGREE);
  const minutes = totalMinutes % MINUTES_PER_DEGREE;

  return `${whole}° ${String(minutes).padStart(2, "0")}′`;
}

/** Example: (43.7064, -79.3986) → "43.71° N, 79.40° W". */
export function formatCoordinates(latitude: number, longitude: number): string {
  const north = `${Math.abs(latitude).toFixed(COORDINATE_DECIMALS)}°`;
  const east = `${Math.abs(longitude).toFixed(COORDINATE_DECIMALS)}°`;

  return (
    `${north} ${latitude < 0 ? "S" : "N"}, ` +
    `${east} ${longitude < 0 ? "W" : "E"}`
  );
}

/**
 * A body's position as the tables show it. Without a birth time, a body
 * that changed sign that day names the other sign it may be in.
 * Example: "29° 40′ Cancer ℞ (may be Leo)".
 */
export function formatPlacement(placed: PlacedBody): string {
  const sign = getSign(placed.longitude);
  const otherSign = placed.possibleSigns?.find(
    (candidate) => candidate !== sign,
  );
  const retrograde = placed.isRetrograde ? " ℞" : "";
  const uncertainty = otherSign ? ` (may be ${otherSign.name})` : "";

  return formatLongitude(placed.longitude) + retrograde + uncertainty;
}

/** Example: "1 January 2000", in the birthplace's time zone. */
export function formatBirthDate(chart: Chart): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: chart.details.place.timeZone,
    dateStyle: "long",
  }).format(chart.bornAt);
}

/**
 * Example: "14 November 2026". A calendar date belongs to no time zone,
 * so it's written as UTC, where it can't slip to a neighbouring day.
 */
export function formatLocalDate({ year, month, day }: LocalDate): string {
  const at = new Date(0);
  at.setUTCFullYear(year, month - 1, day);

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    dateStyle: "long",
  }).format(at);
}

/** Example: "1 January 2000 at 12:00 GMT (12:00 UT)". */
export function formatBirthMoment(chart: Chart): string {
  const universal = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    timeStyle: "short",
  }).format(chart.bornAt);

  const local = formatInstant(chart.bornAt, chart.details.place.timeZone);

  return `${local} (${universal} UT)`;
}

/** Example: "13 November 2026 at 15:05 EST", on `timeZone`'s clock. */
export function formatInstant(at: Date, timeZone: string): string {
  const local = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    dateStyle: "long",
    timeStyle: "short",
  }).format(at);
  // en-US knows abbreviations such as "EDT"; elsewhere it gives "GMT+1".
  const zone = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short",
  })
    .formatToParts(at)
    .find((part) => part.type === "timeZoneName")?.value;

  return zone ? `${local} ${zone}` : local;
}

/** Turns anything thrown into a message fit to show a person. */
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
