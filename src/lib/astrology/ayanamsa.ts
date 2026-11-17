// The sidereal zodiac: signs measured from the stars rather than from the
// spring equinox. The two drift apart by about a degree every 72 years,
// as the equinox precesses; the gap between them is the ayanamsa, and
// traditions differ on where to fix it.

/**
 * Which ayanamsa a sidereal chart uses. A chart with none uses the
 * tropical zodiac.
 */
export enum Ayanamsa {
  Lahiri = "lahiri",
  FaganBradley = "faganBradley",
  Krishnamurti = "krishnamurti",
  Raman = "raman",
  Yukteshwar = "yukteshwar",
  TrueChitra = "trueChitra",
}

/** Lahiri: India's official ayanamsa, and the most widely used. */
export const DEFAULT_AYANAMSA = Ayanamsa.Lahiri;

export const AYANAMSA_NAMES: Record<Ayanamsa, string> = {
  [Ayanamsa.Lahiri]: "Lahiri",
  [Ayanamsa.FaganBradley]: "Fagan–Bradley",
  [Ayanamsa.Krishnamurti]: "Krishnamurti",
  [Ayanamsa.Raman]: "Raman",
  [Ayanamsa.Yukteshwar]: "Yukteshwar",
  [Ayanamsa.TrueChitra]: "True Chitrapaksha",
};

export function isAyanamsa(value: string): value is Ayanamsa {
  return Object.values(Ayanamsa).includes(value as Ayanamsa);
}

/** Example: "Sidereal, Lahiri", or "Tropical" without an ayanamsa. */
export function describeZodiac(ayanamsa: Ayanamsa | undefined): string {
  return ayanamsa ? `Sidereal, ${AYANAMSA_NAMES[ayanamsa]}` : "Tropical";
}
