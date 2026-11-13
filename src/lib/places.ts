// Offline place search over the GeoNames index built by
// scripts/places-build.mjs. The index is fetched once, from this site,
// so queries never leave the browser.

export const PLACE_INDEX_URL = "/data/places.json";
const DEFAULT_RESULT_LIMIT = 8;

export type Place = {
  /** GeoNames ID, e.g. 2643743 for London, England. */
  id: number;
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
  population: number,
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
    const id = row[8];
    const timeZone = raw.timeZones[row[6]];
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

let _loading: Promise<PlaceIndex> | undefined;

/** Fetches and parses the place index once; later calls reuse it. */
export function loadPlaceIndex(): Promise<PlaceIndex> {
  _loading ??= fetch(PLACE_INDEX_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Place index failed to load (${response.status})`);
      }
      return response.json() as Promise<RawPlaceIndex>;
    })
    .then(parsePlaceIndex)
    .catch((error: unknown) => {
      // Allow a retry after a failed fetch instead of caching the failure.
      _loading = undefined;
      throw error;
    });

  return _loading;
}

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
