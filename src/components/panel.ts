// Svelte compiles component scripts without TypeScript enums, so the
// App's panel enum lives here.

/** What's open under your birth form, and so what's drawn beside it. */
export enum Panel {
  None = "none",
  Comparison = "comparison",
  Transits = "transits",
  Progressions = "progressions",
  SolarReturn = "solarReturn",
  LunarReturn = "lunarReturn",
}
