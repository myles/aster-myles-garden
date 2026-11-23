import { isDatetimeString } from "@atproto/syntax";

import type { BirthDetails } from "@/lib/charts/chart";

import { isHouseSystem } from "@/lib/astrology/houses";
import { createCoordinatePlace, parseCoordinates } from "@/lib/places";
import { isTimeZone, toLocal, toUtc } from "@/lib/time";

import { CHART_COLLECTION } from "./config";

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

export type ChartRecord = {
  $type: typeof CHART_COLLECTION;
  bornAt: string;
  isBirthTimeKnown: boolean;
  location: { latitude: string; longitude: string; name?: string };
  timeZone: string;
  houseSystem: string;
  aiPreferences?: AiPreferences;
  updatedAt: string;
};

export function buildChartRecord(
  details: ChartDetails,
  disclosure: TimeDisclosure,
  updatedAt: Date,
): ChartRecord {
  _validateLocalDetails(details);
  const isBirthTimeKnown =
    disclosure === TimeDisclosure.Include && details.time !== undefined;
  const record: ChartRecord = {
    $type: CHART_COLLECTION,
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
  };
  if (details.aiPreferences !== undefined) {
    record.aiPreferences = details.aiPreferences;
  }
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
  if (!_isObject(value)) {
    throw new Error("The saved Aster chart is malformed.");
  }
  const record = value;
  const location = record.location;
  if (
    record.$type !== CHART_COLLECTION ||
    !_isTimestamp(record.bornAt) ||
    typeof record.isBirthTimeKnown !== "boolean" ||
    !_isObject(location) ||
    typeof location.latitude !== "string" ||
    typeof location.longitude !== "string" ||
    (location.name !== undefined &&
      (typeof location.name !== "string" ||
        new TextEncoder().encode(location.name).length >
          MAX_PLACE_NAME_BYTES)) ||
    typeof record.timeZone !== "string" ||
    !isTimeZone(record.timeZone) ||
    typeof record.houseSystem !== "string" ||
    !isHouseSystem(record.houseSystem) ||
    !_isTimestamp(record.updatedAt)
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
      name: typeof location.name === "string" ? location.name : "",
      ...parseCoordinates(`${location.latitude}, ${location.longitude}`),
      timeZone: record.timeZone,
    }),
    houseSystem: record.houseSystem,
  };
  if (record.aiPreferences !== undefined) {
    details.aiPreferences = _parseAiPreferences(record.aiPreferences);
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

function _parseAiPreferences(value: unknown): AiPreferences {
  if (!_isObject(value)) {
    throw new Error("Invalid AI preferences.");
  }
  const preferences: AiPreferences = {};
  for (const key of AI_PREFERENCE_KEYS) {
    const preference = value[key];
    if (preference === undefined) {
      continue;
    }
    if (
      !_isObject(preference) ||
      typeof preference.allow !== "boolean" ||
      !_isTimestamp(preference.updatedAt)
    ) {
      throw new Error("Invalid AI preference.");
    }
    preferences[key] = {
      allow: preference.allow,
      updatedAt: preference.updatedAt,
    };
  }
  return preferences;
}

function _isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function _isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    isDatetimeString(value) &&
    Number.isFinite(Date.parse(value))
  );
}
