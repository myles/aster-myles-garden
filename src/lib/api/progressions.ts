// POST /api/v1/progressions: a natal chart and a date in, the chart
// progressed to that date, set against the natal chart, out.

import { SITE_URL } from "@/consts";
import {
  createProgressions,
  PROGRESSION_MAX_ORB_DEGREES,
  type Progressions,
} from "@/lib/charts/progressions";
import { nodeEphemeris } from "@/lib/server/ephemeris";
import { buildShareUrl } from "@/lib/share";
import { formatDateValue, parseLocalDate } from "@/lib/time";

import {
  createChartForRequest,
  formatAspectForApi,
  formatBodiesInHouses,
  formatChartForApi,
} from "./chart";
import { PROGRESSIONS_PATH } from "./paths";
import { handleJsonPost, todayIn } from "./request";
import {
  progressionsRequestSchemaV1,
  progressionsSchemaV1,
  type ProgressionsV1,
} from "./schemas";

export function formatProgressionsForApi(
  progressions: Progressions,
): ProgressionsV1 {
  const { natal, forDate } = progressions;

  return progressionsSchemaV1.parse({
    natal: formatChartForApi(natal),
    date: formatDateValue(forDate),
    skyAt: progressions.skyAt.toISOString(),
    maxOrbDegrees: PROGRESSION_MAX_ORB_DEGREES,
    bodies: formatBodiesInHouses(
      progressions.bodies,
      progressions.inNatalHouses,
    ),
    aspects: progressions.aspects.map(formatAspectForApi),
    shareUrl: buildShareUrl(natal.details, SITE_URL, {
      progressionsForDate: forDate,
    }),
  });
}

export function handleProgressionsRequest(request: Request): Promise<Response> {
  return handleJsonPost(
    request,
    progressionsRequestSchemaV1,
    PROGRESSIONS_PATH,
    (input) => {
      const natal = createChartForRequest(input.natal, "natal.date");
      const forDate = input.date ? parseLocalDate(input.date) : todayIn("UTC");

      return formatProgressionsForApi(
        createProgressions(natal, forDate, nodeEphemeris),
      );
    },
  );
}
