// Chart settings remembered in this browser between visits: the house
// system and which aspects to find. Like saved charts, they live only in
// the visitor's own storage, which is passed in so tests can fake it.

import {
  isAspectSet,
  isOrbSize,
  type AspectSettings,
} from "@/lib/astrology/aspects";
import { isHouseSystem, type HouseSystem } from "@/lib/astrology/houses";

export const PREFERENCES_KEY = "aster:preferences";

/** Bumped if the stored shape ever changes, so old data is recognised. */
const STORAGE_VERSION = 1;

const DAMAGED_MESSAGE = "Your saved chart settings are damaged.";

export type ChartPreferences = {
  houseSystem: HouseSystem;
  aspectSettings: AspectSettings;
};

/**
 * Undefined when nothing's been saved. Throws when what's stored can't be
 * read as settings, such as a house system this version doesn't know.
 */
export function readPreferences(
  storage: Storage,
): ChartPreferences | undefined {
  const raw = storage.getItem(PREFERENCES_KEY);
  if (raw === null) {
    return undefined;
  }

  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch (cause) {
    throw new Error(DAMAGED_MESSAGE, { cause });
  }

  if (
    !isRecord(stored) ||
    stored.version !== STORAGE_VERSION ||
    !isString(stored.houseSystem, isHouseSystem) ||
    !isString(stored.aspectSet, isAspectSet) ||
    !isString(stored.orbSize, isOrbSize)
  ) {
    throw new Error(DAMAGED_MESSAGE);
  }

  return {
    houseSystem: stored.houseSystem,
    aspectSettings: {
      aspectSet: stored.aspectSet,
      orbSize: stored.orbSize,
    },
  };
}

export function writePreferences(
  storage: Storage,
  preferences: ChartPreferences,
): void {
  const stored = {
    version: STORAGE_VERSION,
    houseSystem: preferences.houseSystem,
    ...preferences.aspectSettings,
  };

  try {
    storage.setItem(PREFERENCES_KEY, JSON.stringify(stored));
  } catch (cause) {
    // Full storage, or a browser that refuses writes.
    throw new Error("This browser wouldn't save your chart settings.", {
      cause,
    });
  }
}

/** A string that passes `guard`, so typed as what it guards for. */
function isString<T extends string>(
  value: unknown,
  guard: (value: string) => value is T,
): value is T {
  return typeof value === "string" && guard(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
