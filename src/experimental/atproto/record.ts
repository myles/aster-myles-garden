import type { BirthDetails } from "@/lib/chart";

import { isHouseSystem } from "@/lib/houses";
import { createCoordinatePlace, parseCoordinates } from "@/lib/places";
import {
  formatDateValue,
  formatTimeValue,
  isTimeZone,
  parseLocalDate,
  parseLocalTime,
} from "@/lib/time";

import { CHART_COLLECTION } from "./config";

export enum TimeDisclosure {
  Omit = "omit",
  Include = "include",
}

export type ChartRecord = {
  $type: typeof CHART_COLLECTION;
  birthDate: string;
  birthTime?: string;
  coordinates: string;
  timeZone: string;
  placeName: string;
  houseSystem: string;
  updatedAt: string;
};

export function buildChartRecord(
  details: BirthDetails,
  disclosure: TimeDisclosure,
  updatedAt: Date,
): ChartRecord {
  const record: ChartRecord = {
    $type: CHART_COLLECTION,
    birthDate: formatDateValue(details.date),
    coordinates: `${details.place.latitude}, ${details.place.longitude}`,
    timeZone: details.place.timeZone,
    placeName: details.place.name,
    houseSystem: details.houseSystem,
    updatedAt: updatedAt.toISOString(),
  };
  if (disclosure === TimeDisclosure.Include && details.time) {
    record.birthTime = formatTimeValue(details.time);
  }
  // Validate outbound details as strictly as records read from the PDS.
  parseChartRecord(record);
  return record;
}

export function parseChartRecord(value: unknown): BirthDetails {
  if (!value || typeof value !== "object") {
    throw new Error("The saved Aster chart is malformed.");
  }
  const record = value as Record<string, unknown>;
  if (
    record.$type !== CHART_COLLECTION ||
    typeof record.birthDate !== "string" ||
    (record.birthTime !== undefined && typeof record.birthTime !== "string") ||
    typeof record.coordinates !== "string" ||
    typeof record.timeZone !== "string" ||
    !isTimeZone(record.timeZone) ||
    typeof record.placeName !== "string" ||
    record.placeName.length > 200 ||
    typeof record.houseSystem !== "string" ||
    !isHouseSystem(record.houseSystem) ||
    typeof record.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(record.updatedAt))
  ) {
    throw new Error("The saved Aster chart is malformed.");
  }

  const date = parseLocalDate(record.birthDate);
  // The shared parsers currently check shape only; do not normalise bad data.
  const calendar = new Date(0);
  calendar.setUTCFullYear(date.year, date.month - 1, date.day);
  if (
    date.year < 1 ||
    calendar.getUTCFullYear() !== date.year ||
    calendar.getUTCMonth() + 1 !== date.month ||
    calendar.getUTCDate() !== date.day
  ) {
    throw new Error("The saved chart has an invalid birth date.");
  }
  const time =
    record.birthTime === undefined
      ? undefined
      : parseLocalTime(record.birthTime);
  if (time && (time.hour > 23 || time.minute > 59)) {
    throw new Error("The saved chart has an invalid birth time.");
  }

  return {
    date,
    time,
    place: createCoordinatePlace({
      name: record.placeName,
      ...parseCoordinates(record.coordinates),
      timeZone: record.timeZone,
    }),
    houseSystem: record.houseSystem,
  };
}
