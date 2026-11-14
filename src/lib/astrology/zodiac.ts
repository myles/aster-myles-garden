export const DEGREES_PER_CIRCLE = 360;
export const DEGREES_PER_SIGN = 30;
const MINUTES_PER_DEGREE = 60;

export const SIGNS = [
  { name: "Aries", glyph: "♈︎", element: "fire" },
  { name: "Taurus", glyph: "♉︎", element: "earth" },
  { name: "Gemini", glyph: "♊︎", element: "air" },
  { name: "Cancer", glyph: "♋︎", element: "water" },
  { name: "Leo", glyph: "♌︎", element: "fire" },
  { name: "Virgo", glyph: "♍︎", element: "earth" },
  { name: "Libra", glyph: "♎︎", element: "air" },
  { name: "Scorpio", glyph: "♏︎", element: "water" },
  { name: "Sagittarius", glyph: "♐︎", element: "fire" },
  { name: "Capricorn", glyph: "♑︎", element: "earth" },
  { name: "Aquarius", glyph: "♒︎", element: "air" },
  { name: "Pisces", glyph: "♓︎", element: "water" },
] as const;

export type Sign = (typeof SIGNS)[number];

/** Wraps any angle into the range [0, 360). */
export function normalizeDegrees(degrees: number): number {
  const wrapped = degrees % DEGREES_PER_CIRCLE;
  return wrapped < 0 ? wrapped + DEGREES_PER_CIRCLE : wrapped;
}

/** Shortest angular distance between two longitudes, in [0, 180]. */
export function separateDegrees(a: number, b: number): number {
  const difference = normalizeDegrees(a - b);
  return Math.min(difference, DEGREES_PER_CIRCLE - difference);
}

export function getSign(longitude: number): Sign {
  const index = Math.floor(normalizeDegrees(longitude) / DEGREES_PER_SIGN);
  return SIGNS[index];
}

/**
 * Formats an ecliptic longitude as degrees and minutes within its sign.
 * Example: 280.37 → "10° 22′ Capricorn".
 */
export function formatLongitude(longitude: number): string {
  const normalized = normalizeDegrees(longitude);

  // Round to whole minutes first so 29° 59.7′ becomes 0° 00′ of the next
  // sign rather than "29° 60′".
  const totalMinutes = Math.round(normalized * MINUTES_PER_DEGREE);
  const wrappedMinutes =
    totalMinutes % (DEGREES_PER_CIRCLE * MINUTES_PER_DEGREE);
  const signMinutes = DEGREES_PER_SIGN * MINUTES_PER_DEGREE;

  const sign = SIGNS[Math.floor(wrappedMinutes / signMinutes)];
  const minutesInSign = wrappedMinutes % signMinutes;
  const degrees = Math.floor(minutesInSign / MINUTES_PER_DEGREE);
  const minutes = minutesInSign % MINUTES_PER_DEGREE;

  return `${degrees}° ${String(minutes).padStart(2, "0")}′ ${sign.name}`;
}
