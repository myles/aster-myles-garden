import type { PlacedBody } from "@/lib/chart";
import { formatLongitude, getSign } from "@/lib/zodiac";

const MINUTES_PER_DEGREE = 60;
const COORDINATE_DECIMALS = 2;

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

/** Turns anything thrown into a message fit to show a person. */
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
