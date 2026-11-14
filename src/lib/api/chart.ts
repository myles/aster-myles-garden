// POST /api/v1/chart: birth details in, a natal chart out.
//
// Birth details are personal, so they only ever arrive in the request
// body, are never written to a log, and the response is never cached.

import { SITE_URL } from "@/consts";
import { ASPECT_INFO, DEFAULT_ASPECT_SETTINGS } from "@/lib/astrology/aspects";
import { BODY_INFO } from "@/lib/astrology/bodies";
import { formatLongitude, getSign } from "@/lib/astrology/zodiac";
import {
  canCalculateDate,
  createChart,
  type BirthDetails,
  type Chart,
} from "@/lib/charts/chart";
import { createCoordinatePlace, parseCoordinates } from "@/lib/places";
import { nodeEphemeris } from "@/lib/server/ephemeris";
import { buildShareUrl } from "@/lib/share";
import { parseLocalDate, parseLocalTime } from "@/lib/time";

import {
  errorResponse,
  HTTP_BAD_REQUEST,
  HTTP_INTERNAL_SERVER_ERROR,
  jsonResponse,
} from "./http";
import {
  chartRequestSchemaV1,
  chartSchemaV1,
  formatValidationError,
  type ChartRequestV1,
  type ChartV1,
} from "./schemas";

/** More than enough digits for parseCoordinates to round from. */
const COORDINATE_INPUT_DIGITS = 10;

const OUT_OF_RANGE_MESSAGE =
  "date: Outside the supported range, roughly 3000 BCE to 3000 CE";

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
  };
}

/** Whether the engine can calculate every moment the chart needs. */
export function isInEngineRange(details: BirthDetails): boolean {
  return canCalculateDate(details.date, details.place.timeZone);
}

function formatAngle(longitude: number) {
  return {
    longitude,
    sign: getSign(longitude).name,
    label: formatLongitude(longitude),
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
    bodies: chart.bodies.map((placed) => ({
      body: placed.body,
      name: BODY_INFO[placed.body].name,
      longitude: placed.longitude,
      latitude: placed.latitude,
      speed: placed.speed,
      sign: getSign(placed.longitude).name,
      label: formatLongitude(placed.longitude),
      isRetrograde: placed.isRetrograde,
      house: placed.house,
      possibleSigns: placed.possibleSigns?.map((sign) => sign.name),
    })),
    houses: houses && {
      cusps: houses.cusps.map((longitude, index) => ({
        house: index + 1,
        ...formatAngle(longitude),
      })),
      ascendant: formatAngle(houses.ascendant),
      midheaven: formatAngle(houses.midheaven),
    },
    aspects: chart.aspects.map((aspect) => ({
      first: aspect.first,
      second: aspect.second,
      type: aspect.type,
      quality: ASPECT_INFO[aspect.type].quality,
      rank: ASPECT_INFO[aspect.type].rank,
      orbDegrees: aspect.orbDegrees,
    })),
    shareUrl: buildShareUrl(details, SITE_URL),
  });
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    // Unparseable JSON is the caller's mistake, answered below as a 400.
    return undefined;
  }
}

export async function handleChartRequest(request: Request): Promise<Response> {
  const body = await readJsonBody(request);
  if (body === undefined) {
    return errorResponse(HTTP_BAD_REQUEST, "body: Expected a JSON object");
  }

  const parsed = chartRequestSchemaV1.safeParse(body);
  if (!parsed.success) {
    return errorResponse(HTTP_BAD_REQUEST, formatValidationError(parsed.error));
  }

  try {
    const details = toBirthDetails(parsed.data);
    if (!isInEngineRange(details)) {
      return errorResponse(HTTP_BAD_REQUEST, OUT_OF_RANGE_MESSAGE);
    }

    return jsonResponse(formatChartForApi(createChart(details, nodeEphemeris)));
  } catch (error) {
    // Only the error's class: engine messages quote the Julian day, which
    // is the birth moment, and a ZodError would quote the chart.
    const name = error instanceof Error ? error.name : typeof error;
    console.error(`Unexpected ${name} in /api/v1/chart`);

    return errorResponse(HTTP_INTERNAL_SERVER_ERROR, "Internal server error");
  }
}
