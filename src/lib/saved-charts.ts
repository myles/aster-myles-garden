// Charts saved in this browser, so people don't retype birth details.
// They live only in the visitor's own storage; nothing is sent anywhere.
// Storage is passed in, so callers choose it and tests can fake it.

import type { Place } from "@/lib/places";
import { parseLocalDate, parseLocalTime } from "@/lib/time";

export const SAVED_CHARTS_KEY = "aster:saved-charts";
export const MAX_NAME_CHARS = 40;

/** Bumped if the stored shape ever changes, so old data is recognised. */
const STORAGE_VERSION = 1;

/** One saved person, with dates and times as the form's inputs hold them. */
export type SavedChart = {
  id: string;
  name: string;
  date: string;
  /** Undefined when the birth time isn't known. */
  time?: string;
  place: Place;
};

type StoredCharts = { version: number; charts: SavedChart[] };

/**
 * The browser's localStorage. Throws when the browser won't allow it,
 * which some private browsing modes and locked-down settings do.
 */
export function getBrowserStorage(): Storage {
  try {
    return window.localStorage;
  } catch (cause) {
    throw new Error("This browser isn't letting the site save charts.", {
      cause,
    });
  }
}

/** Throws when what's stored can't be read as saved charts. */
export function readSavedCharts(storage: Storage): SavedChart[] {
  const raw = storage.getItem(SAVED_CHARTS_KEY);
  if (raw === null) {
    return [];
  }

  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch (cause) {
    throw new Error("The saved charts are damaged.", { cause });
  }

  if (!isStoredCharts(stored)) {
    throw new Error("The saved charts are damaged.");
  }

  return stored.charts;
}

/** Saves a chart under a new id, and returns every saved chart. */
export function addSavedChart(
  storage: Storage,
  chart: Omit<SavedChart, "id">,
): SavedChart[] {
  const name = chart.name.trim();
  if (!name) {
    throw new Error("Give the chart a name.");
  }

  const charts = [
    ...readSavedCharts(storage),
    { ...chart, name, id: crypto.randomUUID() },
  ];
  writeSavedCharts(storage, charts);

  return charts;
}

/** Forgets a saved chart, and returns the ones left. */
export function removeSavedChart(storage: Storage, id: string): SavedChart[] {
  const charts = readSavedCharts(storage).filter((chart) => chart.id !== id);
  writeSavedCharts(storage, charts);

  return charts;
}

function writeSavedCharts(storage: Storage, charts: SavedChart[]): void {
  const stored: StoredCharts = { version: STORAGE_VERSION, charts };

  try {
    storage.setItem(SAVED_CHARTS_KEY, JSON.stringify(stored));
  } catch (cause) {
    // Full storage, or a browser that refuses writes.
    throw new Error("This browser wouldn't save the chart.", { cause });
  }
}

function isStoredCharts(value: unknown): value is StoredCharts {
  return (
    isRecord(value) &&
    value.version === STORAGE_VERSION &&
    Array.isArray(value.charts) &&
    value.charts.every(isSavedChart)
  );
}

function isSavedChart(value: unknown): value is SavedChart {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isDateValue(value.date) &&
    (value.time === undefined || isTimeValue(value.time)) &&
    isPlace(value.place)
  );
}

function isPlace(value: unknown): value is Place {
  return (
    isRecord(value) &&
    // No id means a place entered by its coordinates.
    (value.id === undefined || typeof value.id === "number") &&
    typeof value.name === "string" &&
    typeof value.region === "string" &&
    typeof value.country === "string" &&
    typeof value.latitude === "number" &&
    typeof value.longitude === "number" &&
    typeof value.timeZone === "string"
  );
}

function isDateValue(value: unknown): boolean {
  return typeof value === "string" && parses(() => parseLocalDate(value));
}

function isTimeValue(value: unknown): boolean {
  return typeof value === "string" && parses(() => parseLocalTime(value));
}

/** True when `parse` doesn't throw. Its error only means "not valid". */
function parses(parse: () => unknown): boolean {
  try {
    parse();
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
