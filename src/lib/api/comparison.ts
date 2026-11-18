// POST /api/v1/synastry and /api/v1/composite: two people's birth details
// in, their charts compared, or merged into one, out. Both charts use the
// first's settings, as the page's comparison does.

import type { HouseOverlay } from "@/lib/astrology/houses";
import type { Chart } from "@/lib/charts/chart";

import { SITE_URL } from "@/consts";
import { createComposite, type Composite } from "@/lib/charts/composite";
import {
  compareCharts,
  ComparisonStyle,
  type Synastry,
} from "@/lib/charts/synastry";
import { nodeEphemeris } from "@/lib/server/ephemeris";
import { buildShareUrl } from "@/lib/share";

import {
  createChartForRequest,
  createSecondChart,
  formatAspectForApi,
  formatBodyForApi,
  formatChartForApi,
  formatHousesForApi,
} from "./chart";
import { COMPOSITE_PATH, SYNASTRY_PATH } from "./paths";
import { handleJsonPost } from "./request";
import {
  comparisonRequestSchemaV1,
  compositeSchemaV1,
  synastrySchemaV1,
  type ComparisonRequestV1,
  type CompositeV1,
  type SynastryV1,
} from "./schemas";

function createBothCharts(input: ComparisonRequestV1): [Chart, Chart] {
  const first = createChartForRequest(input.first, "first.date");
  return [first, createSecondChart(input.second, first)];
}

function formatOverlay(overlay: HouseOverlay | undefined) {
  return (
    overlay && Object.entries(overlay).map(([body, house]) => ({ body, house }))
  );
}

export function formatSynastryForApi(synastry: Synastry): SynastryV1 {
  const { first, second } = synastry;

  return synastrySchemaV1.parse({
    first: formatChartForApi(first),
    second: formatChartForApi(second),
    aspects: synastry.aspects.map(formatAspectForApi),
    secondInFirstHouses: formatOverlay(synastry.secondInFirstHouses),
    firstInSecondHouses: formatOverlay(synastry.firstInSecondHouses),
    shareUrl: buildShareUrl(first.details, SITE_URL, {
      comparedWith: second.details,
    }),
  });
}

export function formatCompositeForApi(composite: Composite): CompositeV1 {
  const { first, second, houses } = composite;

  return compositeSchemaV1.parse({
    first: formatChartForApi(first),
    second: formatChartForApi(second),
    effectiveHouseSystem: houses?.houseSystem,
    bodies: composite.bodies.map((placed) => formatBodyForApi(placed)),
    houses: houses && formatHousesForApi(houses),
    aspects: composite.aspects.map(formatAspectForApi),
    shareUrl: buildShareUrl(first.details, SITE_URL, {
      comparedWith: second.details,
      comparisonStyle: ComparisonStyle.Composite,
    }),
  });
}

export function handleSynastryRequest(request: Request): Promise<Response> {
  return handleJsonPost(
    request,
    comparisonRequestSchemaV1,
    SYNASTRY_PATH,
    (input) => formatSynastryForApi(compareCharts(...createBothCharts(input))),
  );
}

export function handleCompositeRequest(request: Request): Promise<Response> {
  return handleJsonPost(
    request,
    comparisonRequestSchemaV1,
    COMPOSITE_PATH,
    (input) => {
      const [first, second] = createBothCharts(input);
      return formatCompositeForApi(
        createComposite(first, second, nodeEphemeris),
      );
    },
  );
}
