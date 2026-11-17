import { isAyanamsa, type Ayanamsa } from "@/lib/astrology/ayanamsa";

/** The zodiac select's value for the tropical zodiac. */
export const TROPICAL = "tropical";

/** The select's value read back: undefined means tropical. */
export function toAyanamsa(zodiac: string): Ayanamsa | undefined {
  return isAyanamsa(zodiac) ? zodiac : undefined;
}
