// POST /api/v1/chart: birth details in, a natal chart out.
//
// Birth details are personal, so they only ever arrive in the request
// body, are never written to a log, and the response is never cached.

import type { Aspect } from "@/lib/astrology/aspects";
import type { HouseOverlay } from "@/lib/astrology/houses";

import { SITE_URL } from "@/consts";
import { ASPECT_INFO, DEFAULT_ASPECT_SETTINGS } from "@/lib/astrology/aspects";
import { BODY_INFO } from "@/lib/astrology/bodies";
import { formatLongitude, getSign } from "@/lib/astrology/zodiac";
import {
  canCalculateDate,
  createChart,
  type BirthDetails,
  type Chart,
  type PlacedBody,
} from "@/lib/charts/chart";
import { createCoordinatePlace, parseCoordinates } from "@/lib/places";
import { nodeEphemeris } from "@/lib/server/ephemeris";
import { buildShareUrl } from "@/lib/share";
import { parseLocalDate, parseLocalTime } from "@/lib/time";

import { CHART_PATH } from "./paths";
import { handleJsonPost, InputError } from "./request";
import {
  chartRequestSchemaV1,
  chartSchemaV1,
  type AspectV1,
  type ChartRequestV1,
  type ChartV1,
  type PlacedBodyV1,
} from "./schemas";

/** More than enough digits for parseCoordinates to round from. */
const COORDINATE_INPUT_DIGITS = 10;

/** Names the field, so a nested chart's message can name its own. */
export const outOfRangeMessage = (field: string) =>
  `${field}: Outside the supported range, roughly 3000 BCE to 3000 CE`;

/**
 * Turns a validated request into the chart service's birth details.
 * Coordinates are rounded as a share link rounds them, so the chart
 * returned is exactly the one its share link draws.
 */
export function toBirthDetails(request: ChartRequestV1): BirthDetails {
  const coordinates = parseCoordinates(
    `${request.latitude.toFixed(COORDINATE_INPUT_DIGITS)}, ` +
      request.longitude.toFixed(COORDINATE_INPUT_DIGITS),
  );

  return {
    date: parseLocalDate(request.date),
    time: request.time === undefined ? undefined : parseLocalTime(request.time),
    place: createCoordinatePlace({
      ...coordinates,
      name: request.placeName ?? "",
      timeZone: request.timeZone,
    }),
    houseSystem: request.houseSystem,
    aspectSettings: {
      aspectSet: request.aspectSet,
      orbSize: request.orbSize,
    },
    ayanamsa: request.ayanamsa,
  };
}

/**
 * The natal chart a request asks for. Throws an InputError, naming
 * `field`, for a date the engine can't calculate.
 */
export function createChartForRequest(
  request: ChartRequestV1,
  field = "date",
): Chart {
  const details = toBirthDetails(request);
  if (!isInEngineRange(details)) {
    throw new InputError(outOfRangeMessage(field));
  }

  return createChart(details, nodeEphemeris);
}

/** Whether the engine can calculate every moment the chart needs. */
export function isInEngineRange(details: BirthDetails): boolean {
  return canCalculateDate(details.date, details.place.timeZone);
}

export function formatAngle(longitude: number) {
  return {
    longitude,
    sign: getSign(longitude).name,
    label: formatLongitude(longitude),
  };
}

/**
 * A body as the API shows it. `house` overrides the body's own, for a
 * body set in another chart's houses, as a transiting one is.
 */
export function formatBodyForApi(
  placed: PlacedBody,
  house = placed.house,
): PlacedBodyV1 {
  return {
    body: placed.body,
    name: BODY_INFO[placed.body].name,
    longitude: placed.longitude,
    latitude: placed.latitude,
    speed: placed.speed,
    sign: getSign(placed.longitude).name,
    label: formatLongitude(placed.longitude),
    isRetrograde: placed.isRetrograde,
    house,
    possibleSigns: placed.possibleSigns?.map((sign) => sign.name),
  };
}

/** Bodies set in another chart's houses, as an overlay places them. */
export function formatBodiesInHouses(
  bodies: PlacedBody[],
  overlay: HouseOverlay | undefined,
): PlacedBodyV1[] {
  return bodies.map((placed) =>
    formatBodyForApi(placed, overlay?.[placed.body]),
  );
}

export function formatAspectForApi(aspect: Aspect): AspectV1 {
  return {
    first: aspect.first,
    second: aspect.second,
    type: aspect.type,
    quality: ASPECT_INFO[aspect.type].quality,
    rank: ASPECT_INFO[aspect.type].rank,
    orbDegrees: aspect.orbDegrees,
  };
}

export function formatChartForApi(chart: Chart): ChartV1 {
  const { details, houses } = chart;
  const aspectSettings = details.aspectSettings ?? DEFAULT_ASPECT_SETTINGS;

  return chartSchemaV1.parse({
    bornAt: chart.bornAt.toISOString(),
    julianDay: chart.julianDay,
    isTimeKnown: details.time !== undefined,
    houseSystem: details.houseSystem,
    effectiveHouseSystem: houses?.houseSystem,
    aspectSet: aspectSettings.aspectSet,
    orbSize: aspectSettings.orbSize,
    ayanamsa: details.ayanamsa,
    ayanamsaDegrees: chart.ayanamsaDegrees,
    bodies: chart.bodies.map((placed) => formatBodyForApi(placed)),
    houses: houses && {
      cusps: houses.cusps.map((longitude, index) => ({
        house: index + 1,
        ...formatAngle(longitude),
      })),
      ascendant: formatAngle(houses.ascendant),
      midheaven: formatAngle(houses.midheaven),
    },
    aspects: chart.aspects.map(formatAspectForApi),
    shareUrl: buildShareUrl(details, SITE_URL),
  });
}

export function handleChartRequest(request: Request): Promise<Response> {
  return handleJsonPost(request, chartRequestSchemaV1, CHART_PATH, (input) =>
    formatChartForApi(createChartForRequest(input)),
  );
}
