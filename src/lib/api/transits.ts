// POST /api/v1/transits: a natal chart and a moment in, the sky at that
// moment set against the chart out, with when each transit is exact.

import { SITE_URL } from "@/consts";
import { canCalculateMoment } from "@/lib/charts/chart";
import {
  createTransits,
  TRANSIT_MAX_ORB_DEGREES,
  type Transits,
} from "@/lib/charts/transits";
import { nodeEphemeris } from "@/lib/server/ephemeris";
import { buildShareUrl } from "@/lib/share";

import {
  createChartForRequest,
  formatAspectForApi,
  formatBodiesInHouses,
  formatChartForApi,
  outOfRangeMessage,
} from "./chart";
import { TRANSITS_PATH } from "./paths";
import { handleJsonPost, InputError } from "./request";
import {
  transitsRequestSchemaV1,
  transitsSchemaV1,
  type TransitsRequestV1,
  type TransitsV1,
} from "./schemas";

const MS_PER_MINUTE = 60_000;

/**
 * The moment a request asks for, to the minute, as a share link carries
 * it, so the link shows what the API returned. Defaults to `now`.
 */
export function readTransitMoment(
  request: TransitsRequestV1,
  now = new Date(),
): Date {
  const at = request.at === undefined ? now : new Date(request.at);
  return new Date(Math.floor(at.getTime() / MS_PER_MINUTE) * MS_PER_MINUTE);
}

export function formatTransitsForApi(transits: Transits): TransitsV1 {
  const { natal, at } = transits;

  return transitsSchemaV1.parse({
    natal: formatChartForApi(natal),
    at: at.toISOString(),
    maxOrbDegrees: TRANSIT_MAX_ORB_DEGREES,
    bodies: formatBodiesInHouses(transits.bodies, transits.inNatalHouses),
    aspects: transits.aspects.map((aspect) => ({
      ...formatAspectForApi(aspect),
      timing: {
        entersOrb: aspect.timing.entersOrb?.toISOString(),
        exact: aspect.timing.exact.map((moment) => moment.toISOString()),
        leavesOrb: aspect.timing.leavesOrb?.toISOString(),
      },
    })),
    shareUrl: buildShareUrl(natal.details, SITE_URL, { transitsAt: at }),
  });
}

export function handleTransitsRequest(request: Request): Promise<Response> {
  return handleJsonPost(
    request,
    transitsRequestSchemaV1,
    TRANSITS_PATH,
    (input) => {
      const natal = createChartForRequest(input.natal, "natal.date");
      const at = readTransitMoment(input);
      if (!canCalculateMoment(at)) {
        throw new InputError(outOfRangeMessage("at"));
      }

      return formatTransitsForApi(createTransits(natal, at, nodeEphemeris));
    },
  );
}
