// POST /api/v1/solar-return and /api/v1/lunar-return: a natal chart in,
// the chart for when the Sun, or the Moon, gets back to its natal
// position out, cast where the person is then.

import type { Chart } from "@/lib/charts/chart";
import type { Place } from "@/lib/places";

import { SITE_URL } from "@/consts";
import { createLunarReturn, type LunarReturn } from "@/lib/charts/lunar-return";
import {
  createSolarReturn,
  findCurrentReturnYear,
  type SolarReturn,
} from "@/lib/charts/solar-return";
import { nodeEphemeris } from "@/lib/server/ephemeris";
import { buildShareUrl } from "@/lib/share";
import { parseLocalDate, type LocalDate } from "@/lib/time";

import { createChartForRequest, formatChartForApi, toPlace } from "./chart";
import { LUNAR_RETURN_PATH, SOLAR_RETURN_PATH } from "./paths";
import { handleJsonPost, todayIn } from "./request";
import {
  lunarReturnRequestSchemaV1,
  lunarReturnSchemaV1,
  solarReturnRequestSchemaV1,
  solarReturnSchemaV1,
  type LunarReturnV1,
  type PlaceRequestV1,
  type SolarReturnV1,
} from "./schemas";

/** Where a return is cast: the place asked for, or the birthplace. */
function readReturnPlace(
  natal: Chart,
  place: PlaceRequestV1 | undefined,
): Place {
  return place ? toPlace(place) : natal.details.place;
}

export function formatSolarReturnForApi(
  solarReturn: SolarReturn,
): SolarReturnV1 {
  const { natal, year, chart } = solarReturn;

  return solarReturnSchemaV1.parse({
    natal: formatChartForApi(natal),
    chart: formatChartForApi(chart),
    year,
    shareUrl: buildShareUrl(natal.details, SITE_URL, {
      solarReturn: { year, place: chart.details.place },
    }),
  });
}

export function formatLunarReturnForApi(
  lunarReturn: LunarReturn,
  date: LocalDate,
): LunarReturnV1 {
  const { natal, chart } = lunarReturn;

  return lunarReturnSchemaV1.parse({
    natal: formatChartForApi(natal),
    chart: formatChartForApi(chart),
    shareUrl: buildShareUrl(natal.details, SITE_URL, {
      lunarReturn: { date, place: chart.details.place },
    }),
  });
}

export function handleSolarReturnRequest(request: Request): Promise<Response> {
  return handleJsonPost(
    request,
    solarReturnRequestSchemaV1,
    SOLAR_RETURN_PATH,
    (input) => {
      const natal = createChartForRequest(input.natal, "natal.date");
      const place = readReturnPlace(natal, input.place);
      const year =
        input.year ?? findCurrentReturnYear(natal, new Date(), nodeEphemeris);

      return formatSolarReturnForApi(
        createSolarReturn(natal, year, place, nodeEphemeris),
      );
    },
  );
}

export function handleLunarReturnRequest(request: Request): Promise<Response> {
  return handleJsonPost(
    request,
    lunarReturnRequestSchemaV1,
    LUNAR_RETURN_PATH,
    (input) => {
      const natal = createChartForRequest(input.natal, "natal.date");
      const place = readReturnPlace(natal, input.place);
      const date = input.date
        ? parseLocalDate(input.date)
        : todayIn(place.timeZone);

      return formatLunarReturnForApi(
        createLunarReturn(natal, date, place, nodeEphemeris),
        date,
      );
    },
  );
}
