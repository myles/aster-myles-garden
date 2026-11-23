import type * as preferenceAi from "@/lexicons/community/lexicon/preference/ai";
import type { BirthDetails } from "@/lib/charts/chart";

import * as chart from "@/lexicons/garden/myles/aster/chart";
import { isHouseSystem } from "@/lib/astrology/houses";
import { createCoordinatePlace, parseCoordinates } from "@/lib/places";
import { isTimeZone, toLocal, toUtc } from "@/lib/time";

const MAX_PLACE_NAME_BYTES = 200;
const NOON_TIME = { hour: 12, minute: 0 };
const AI_PREFERENCE_KEYS = [
  "training",
  "embedding",
  "inference",
  "syntheticContent",
] as const;

type AiPreference = { allow: boolean; updatedAt: string };
export type AiPreferences = Partial<
  Record<(typeof AI_PREFERENCE_KEYS)[number], AiPreference>
>;
export type ChartDetails = BirthDetails & { aiPreferences?: AiPreferences };

export enum TimeDisclosure {
  Omit = "omit",
  Include = "include",
}

export type ChartRecord = chart.Main;

export function buildChartRecord(
  details: ChartDetails,
  disclosure: TimeDisclosure,
  updatedAt: Date,
): ChartRecord {
  _validateLocalDetails(details);
  const isBirthTimeKnown =
    disclosure === TimeDisclosure.Include && details.time !== undefined;
  const record = chart.$parse({
    $type: chart.$type,
    bornAt: toUtc(
      {
        ...details.date,
        ...(isBirthTimeKnown ? details.time! : NOON_TIME),
      },
      details.place.timeZone,
    ).toISOString(),
    isBirthTimeKnown,
    location: {
      latitude: String(details.place.latitude),
      longitude: String(details.place.longitude),
      name: details.place.name,
    },
    timeZone: details.place.timeZone,
    houseSystem: details.houseSystem,
    updatedAt: updatedAt.toISOString(),
    ...(details.aiPreferences !== undefined && {
      aiPreferences: details.aiPreferences,
    }),
  });
  const restored = parseChartRecord(record);
  if (
    restored.date.year !== details.date.year ||
    restored.date.month !== details.date.month ||
    restored.date.day !== details.date.day
  ) {
    throw new Error("The birth date does not exist in that time zone.");
  }
  return record;
}

export function parseChartRecord(value: unknown): ChartDetails {
  const result = chart.$safeParse(value);
  if (!result.success) {
    throw new Error("The saved Aster chart is malformed.");
  }
  const record = result.value;
  const location = record.location;
  // What the lexicon can't say: a zone the browser knows, a house system
  // Aster draws, and Aster's own bound on the place name.
  if (
    !isTimeZone(record.timeZone) ||
    !isHouseSystem(record.houseSystem) ||
    (location.name !== undefined &&
      new TextEncoder().encode(location.name).length > MAX_PLACE_NAME_BYTES)
  ) {
    throw new Error("The saved Aster chart is malformed.");
  }
  const instant = new Date(record.bornAt);
  const local = toLocal(instant, record.timeZone);
  if (local.year < 1 || local.year > 9999) {
    throw new Error("The saved birth date is outside the supported range.");
  }
  // Compare the full instant: historical local offsets include seconds.
  if (
    !record.isBirthTimeKnown &&
    toUtc({ ...local, ...NOON_TIME }, record.timeZone).getTime() !==
      instant.getTime()
  ) {
    throw new Error("An unknown birth time must use local noon.");
  }
  const details: ChartDetails = {
    date: { year: local.year, month: local.month, day: local.day },
    time: record.isBirthTimeKnown
      ? { hour: local.hour, minute: local.minute }
      : undefined,
    place: createCoordinatePlace({
      name: location.name ?? "",
      ...parseCoordinates(`${location.latitude}, ${location.longitude}`),
      timeZone: record.timeZone,
    }),
    houseSystem: record.houseSystem,
  };
  if (record.aiPreferences !== undefined) {
    details.aiPreferences = _toAiPreferences(record.aiPreferences);
  }
  return details;
}

function _validateLocalDetails(details: BirthDetails): void {
  const { year, month, day } = details.date;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (
    ![year, month, day].every(Number.isInteger) ||
    year < 1 ||
    year > 9999 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day ||
    !isTimeZone(details.place.timeZone)
  ) {
    throw new Error("Invalid birth date or time zone.");
  }
  if (
    details.time &&
    (!Number.isInteger(details.time.hour) ||
      details.time.hour < 0 ||
      details.time.hour > 23 ||
      !Number.isInteger(details.time.minute) ||
      details.time.minute < 0 ||
      details.time.minute > 59)
  ) {
    throw new Error("Invalid birth time.");
  }
}

/** Only the four preferences Aster knows, without their `$type`s. */
function _toAiPreferences(set: preferenceAi.PreferenceSet): AiPreferences {
  const preferences: AiPreferences = {};
  for (const key of AI_PREFERENCE_KEYS) {
    const preference = set[key];
    if (preference === undefined) {
      continue;
    }
    preferences[key] = {
      allow: preference.allow,
      updatedAt: preference.updatedAt,
    };
  }
  return preferences;
}
