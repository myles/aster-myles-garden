// Offline place search over the GeoNames indexes built by
// scripts/places-build.mjs. They're fetched once, from this site, so
// queries never leave the browser. Every city is in the whole index; the
// top one holds only the biggest, to search while the whole one loads.

import { formatCoordinates } from "@/lib/format";

export const PLACE_INDEX_URL = "/data/places-all.json";
/**
 * Cities of 100,000 or more, in the whole index's order. Every one has
 * more people than any city left out, so its results come first, in the
 * same order, once the whole index is searched.
 */
export const TOP_PLACE_INDEX_URL = "/data/places-top.json";
const DEFAULT_RESULT_LIMIT = 8;

const EARTH_RADIUS_KM = 6371;

/** Four decimal places is about 11 metres, as the index stores them. */
const COORDINATE_DECIMALS = 4;
const MAX_LATITUDE_DEGREES = 90;
const MAX_LONGITUDE_DEGREES = 180;

const DECIMAL_PATTERN = /^[-+]?\d+(\.\d+)?$/;
const COORDINATE_EXAMPLE = "43.7064, -79.3986";

export type Place = {
  /**
   * GeoNames ID, e.g. 2643743 for London, England. Undefined for a place
   * entered by its coordinates, which isn't in the index.
   */
  id?: number;
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  timeZone: string;
};

/** Row layout written by scripts/places-build.mjs. */
type PlaceRow = [
  name: string,
  asciiName: string,
  region: string,
  country: string,
  latitude: number,
  longitude: number,
  timeZoneIndex: number,
  geonameId: number,
];

export type RawPlaceIndex = {
  timeZones: string[];
  places: PlaceRow[];
};

type IndexedPlace = {
  place: Place;
  searchNames: string[];
  searchQualifier: string;
};

export type PlaceIndex = {
  entries: IndexedPlace[];
};

/**
 * Folds case and strips diacritics so "montreal" finds "Montréal".
 */
export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function parsePlaceIndex(raw: RawPlaceIndex): PlaceIndex {
  const entries = raw.places.map((row) => {
    const [name, asciiName, region, country, latitude, longitude] = row;
    const [, , , , , , timeZoneIndex, id] = row;
    const timeZone = raw.timeZones[timeZoneIndex];
    const searchNames = [normalizeSearchText(name)];

    if (asciiName) {
      searchNames.push(normalizeSearchText(asciiName));
    }

    return {
      place: { id, name, region, country, latitude, longitude, timeZone },
      searchNames,
      searchQualifier: normalizeSearchText(`${region} ${country}`),
    };
  });

  return { entries };
}

/** Fetches and parses an index once; later calls share the promise. */
function createLoader(url: string): () => Promise<PlaceIndex> {
  let loading: Promise<PlaceIndex> | undefined;

  return () => {
    loading ??= fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Place index failed to load (${response.status})`);
        }
        return response.json() as Promise<RawPlaceIndex>;
      })
      .then(parsePlaceIndex)
      .catch((error: unknown) => {
        // Allow a retry after a failed fetch instead of caching the failure.
        loading = undefined;
        throw error;
      });

    return loading;
  };
}

/** Every city: for search, and for looking a place up by its ID. */
export const loadPlaceIndex = createLoader(PLACE_INDEX_URL);

/** The biggest cities only, to search while the whole index loads. */
export const loadTopPlaceIndex = createLoader(TOP_PLACE_INDEX_URL);

/**
 * Searches by place name, most populous first. Text after a comma
 * narrows by region or country: "london, canada" finds London, Ontario.
 * Prefix matches rank ahead of matches inside a name.
 */
export function searchPlaces(
  index: PlaceIndex,
  query: string,
  limit = DEFAULT_RESULT_LIMIT,
): Place[] {
  const [rawName, ...rawQualifiers] = query.split(",");
  const name = normalizeSearchText(rawName);
  const qualifiers = rawQualifiers
    .map(normalizeSearchText)
    .filter((qualifier) => qualifier.length > 0);

  if (!name) {
    return [];
  }

  const prefixMatches: Place[] = [];
  const innerMatches: Place[] = [];

  for (const entry of index.entries) {
    if (prefixMatches.length >= limit) {
      break;
    }

    const isQualified = qualifiers.every((qualifier) =>
      entry.searchQualifier.includes(qualifier),
    );
    if (!isQualified) {
      continue;
    }

    if (entry.searchNames.some((candidate) => candidate.startsWith(name))) {
      prefixMatches.push(entry.place);
      continue;
    }

    if (entry.searchNames.some((candidate) => candidate.includes(name))) {
      innerMatches.push(entry.place);
    }
  }

  return [...prefixMatches, ...innerMatches].slice(0, limit);
}

/** Looks a place up by its GeoNames ID. */
export function findPlace(index: PlaceIndex, id: number): Place | undefined {
  return index.entries.find((entry) => entry.place.id === id)?.place;
}

/** Example: "Toronto, Ontario, Canada". */
export function formatPlace(place: Place): string {
  return [place.name, place.region, place.country]
    .filter((part) => part.length > 0)
    .join(", ");
}

/**
 * The listed place nearest to a point, and how far away it is, along the
 * Earth's surface. Undefined only when the index is empty.
 */
export function findNearestPlace(
  index: PlaceIndex,
  latitude: number,
  longitude: number,
): { place: Place; distanceKm: number } | undefined {
  let nearest: { place: Place; distanceKm: number } | undefined;

  for (const { place } of index.entries) {
    const distanceKm = measureDistanceKm(
      latitude,
      longitude,
      place.latitude,
      place.longitude,
    );

    if (!nearest || distanceKm < nearest.distanceKm) {
      nearest = { place, distanceKm };
    }
  }

  return nearest;
}

/**
 * Reads coordinates as map apps copy them: latitude then longitude, in
 * decimal degrees, with south and west negative.
 * Example: "43.70640, -79.39860" → latitude 43.7064, longitude -79.3986.
 */
export function parseCoordinates(text: string): {
  latitude: number;
  longitude: number;
} {
  const parts = text
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);

  if (
    parts.length !== 2 ||
    !parts.every((part) => DECIMAL_PATTERN.test(part))
  ) {
    throw new Error(
      `Enter a latitude and longitude, e.g. ${COORDINATE_EXAMPLE}.`,
    );
  }

  const [latitude, longitude] = parts.map(roundCoordinate);

  if (Math.abs(latitude) > MAX_LATITUDE_DEGREES) {
    throw new Error("Latitude must be between -90 and 90.");
  }
  if (Math.abs(longitude) > MAX_LONGITUDE_DEGREES) {
    throw new Error("Longitude must be between -180 and 180.");
  }

  return { latitude, longitude };
}

/**
 * A place entered by its coordinates rather than chosen from the index.
 * Without a name, it's called by its coordinates.
 */
export function createCoordinatePlace(fields: {
  name: string;
  latitude: number;
  longitude: number;
  timeZone: string;
}): Place {
  const { latitude, longitude, timeZone } = fields;

  return {
    name: fields.name.trim() || formatCoordinates(latitude, longitude),
    region: "",
    country: "",
    latitude,
    longitude,
    timeZone,
  };
}

function roundCoordinate(text: string): number {
  return Number(Number(text).toFixed(COORDINATE_DECIMALS));
}

/** Great-circle distance by the haversine formula. */
function measureDistanceKm(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
): number {
  const latitudeChange = toRadians(toLatitude - fromLatitude);
  const longitudeChange = toRadians(toLongitude - fromLongitude);
  const a =
    Math.sin(latitudeChange / 2) ** 2 +
    Math.cos(toRadians(fromLatitude)) *
      Math.cos(toRadians(toLatitude)) *
      Math.sin(longitudeChange / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
