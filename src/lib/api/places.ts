// GET /api/v1/places?q=: the site's place search, so a caller can find a
// birthplace's latitude, longitude and time zone for /api/v1/chart.

import { formatPlace, searchPlaces, type Place } from "@/lib/places";
import { getPlaceIndex } from "@/lib/server/places";

import {
  CACHE_PUBLIC_DAY,
  errorResponse,
  HTTP_BAD_REQUEST,
  jsonResponse,
} from "./http";
import {
  formatValidationError,
  placeSchemaV1,
  placesPageSchemaV1,
  placesQuerySchemaV1,
  type PlaceV1,
} from "./schemas";

export function formatPlaceForApi(place: Place): PlaceV1 {
  return placeSchemaV1.parse({
    id: place.id,
    name: place.name,
    region: place.region,
    country: place.country,
    label: formatPlace(place),
    latitude: place.latitude,
    longitude: place.longitude,
    timeZone: place.timeZone,
  });
}

export function handlePlacesRequest(request: Request): Response {
  const params = new URL(request.url).searchParams;
  const parsed = placesQuerySchemaV1.safeParse(Object.fromEntries(params));

  if (!parsed.success) {
    return errorResponse(HTTP_BAD_REQUEST, formatValidationError(parsed.error));
  }

  const { q, limit } = parsed.data;
  const result = searchPlaces(getPlaceIndex(), q, limit).map(formatPlaceForApi);
  const page = placesPageSchemaV1.parse({
    next: null,
    previous: null,
    count: result.length,
    result,
  });

  // The index only changes on a rebuild, so a search can be cached.
  return jsonResponse(page, { cacheControl: CACHE_PUBLIC_DAY });
}
