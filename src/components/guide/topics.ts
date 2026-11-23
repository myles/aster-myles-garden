// The guide's topics. Each is a Markdown file under src/content/guide/,
// named by its path there, so a toggle can't point at a missing file.

import { getContext, setContext } from "svelte";

export enum GuideTopic {
  BirthDate = "birth-details/date",
  BirthTime = "birth-details/time",
  BirthPlace = "birth-details/place",
  HouseSystem = "settings/house-system",
  Zodiac = "settings/zodiac",
  Aspects = "settings/aspects",
  Orbs = "settings/orbs",
  Wheel = "chart/wheel",
  Positions = "chart/positions",
  AspectsTable = "chart/aspects-table",
  Comparison = "chart-types/comparison",
  Composite = "chart-types/composite",
  Transits = "chart-types/transits",
  Progressions = "chart-types/progressions",
  SolarReturn = "chart-types/solar-return",
  LunarReturn = "chart-types/lunar-return",
}

/** A topic's title, and its Markdown rendered to HTML at build time. */
export type GuideEntry = { title: string; html: string };
export type GuideEntries = Record<GuideTopic, GuideEntry>;

/** The guide page's sections, in order, by their folder. */
export const GUIDE_SECTIONS = [
  { folder: "birth-details", heading: "Birth details" },
  { folder: "settings", heading: "Chart settings" },
  { folder: "chart", heading: "Reading the chart" },
  { folder: "chart-types", heading: "Other charts" },
];

// With the slash: some static servers, such as vite preview, answer
// "/guide" with the home page.
export const GUIDE_PATH = "/guide/";

const GUIDE_CONTEXT_KEY = Symbol("guide");

/** "settings/house-system" → "settings-house-system". */
export function toGuideAnchor(topic: string): string {
  return topic.replaceAll("/", "-");
}

/** Shares the guide with every toggle under the calling component. */
export function setGuide(guide: GuideEntries | undefined): void {
  setContext(GUIDE_CONTEXT_KEY, guide);
}

/** The guide App shared, or undefined outside it, as in tests. */
export function getGuide(): GuideEntries | undefined {
  return getContext(GUIDE_CONTEXT_KEY);
}
