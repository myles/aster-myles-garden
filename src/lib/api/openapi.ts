// The OpenAPI document for /api/v1, generated from the same schemas that
// guard the routes. createDocument throws on anything it can't represent,
// so a schema it can't describe fails the build and the tests.

import type { z } from "astro/zod";

import { createDocument, type ZodOpenApiObject } from "zod-openapi";

import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL, SOURCE_URL } from "@/consts";

import { HTTP_BAD_REQUEST, HTTP_INTERNAL_SERVER_ERROR, HTTP_OK } from "./http";
import {
  CHART_PATH,
  COMPOSITE_PATH,
  LUNAR_RETURN_PATH,
  PLACES_PATH,
  PROGRESSIONS_PATH,
  SOLAR_RETURN_PATH,
  SYNASTRY_PATH,
  TRANSITS_PATH,
} from "./paths";
import {
  chartRequestSchemaV1,
  chartSchemaV1,
  comparisonRequestSchemaV1,
  compositeSchemaV1,
  errorSchemaV1,
  lunarReturnRequestSchemaV1,
  lunarReturnSchemaV1,
  placesPageSchemaV1,
  placesQuerySchemaV1,
  progressionsRequestSchemaV1,
  progressionsSchemaV1,
  solarReturnRequestSchemaV1,
  solarReturnSchemaV1,
  synastrySchemaV1,
  transitsRequestSchemaV1,
  transitsSchemaV1,
} from "./schemas";

const OPENAPI_VERSION = "3.1.0";
const API_VERSION = "1.0.0";
const JSON_MEDIA_TYPE = "application/json";
const LICENSE_NAME = "AGPL-3.0-only";
const AUTHOR_NAME = "Myles Braithwaite";

export * from "./paths";

const TAG_CHARTS = "Charts";
const TAG_PLACES = "Places";

const buildJsonContent = (schema: z.ZodType) => ({
  content: { [JSON_MEDIA_TYPE]: { schema } },
});

const buildErrorResponse = (description: string) => ({
  description,
  ...buildJsonContent(errorSchemaV1),
});

type Calculation = {
  operationId: string;
  summary: string;
  description: string;
  request: z.ZodType;
  response: z.ZodType;
  /** What's returned, as "The chart". */
  what: string;
  /** The 400's own reason, after the ones every route shares. */
  badRequest: string;
};

/** A POST route that calculates something from a JSON body. */
const buildCalculation = ({
  request,
  response,
  what,
  badRequest,
  ...operation
}: Calculation) => ({
  post: {
    ...operation,
    tags: [TAG_CHARTS],
    requestBody: { required: true, ...buildJsonContent(request) },
    responses: {
      [HTTP_OK]: { description: `${what}.`, ...buildJsonContent(response) },
      [HTTP_BAD_REQUEST]: buildErrorResponse(
        `The body isn't JSON, a field is invalid, or ${badRequest}`,
      ),
      [HTTP_INTERNAL_SERVER_ERROR]: buildErrorResponse(
        `${what} couldn't be calculated.`,
      ),
    },
  },
});

const DOCUMENT: ZodOpenApiObject = {
  openapi: OPENAPI_VERSION,
  info: {
    title: SITE_TITLE,
    version: API_VERSION,
    description:
      `${SITE_DESCRIPTION} This API calculates the same charts on a ` +
      "server, with the same Swiss Ephemeris (Moshier) engine, so a " +
      "chart's share link draws what the API returned. Birth " +
      "details travel only in request bodies, and are never logged or " +
      "stored. Absent fields are omitted, never null.",
    contact: { name: AUTHOR_NAME, url: SOURCE_URL },
    license: { name: LICENSE_NAME, identifier: LICENSE_NAME },
  },
  servers: [{ url: SITE_URL }],
  // Public: no operation takes credentials.
  security: [],
  tags: [
    {
      name: TAG_CHARTS,
      description:
        "Natal charts from birth details, and charts made from them. " +
        "Each takes a natal chart's request whole, as `natal`.",
    },
    {
      name: TAG_PLACES,
      description:
        "GeoNames cities with a population over 15,000, to find a " +
        "birthplace's coordinates and time zone.",
    },
  ],
  paths: {
    [CHART_PATH]: buildCalculation({
      operationId: "createChart",
      summary: "Calculate a natal chart",
      description:
        "Positions, houses and aspects for a birth date, local time and " +
        "place. Without a time, the chart is cast for local noon and " +
        "has no houses or angles. Above the polar circles, Placidus " +
        "and Koch can't be cast, so the houses fall back to Porphyry " +
        "and `effectiveHouseSystem` says so. Positions are in the " +
        "tropical zodiac unless an `ayanamsa` is given for the sidereal.",
      request: chartRequestSchemaV1,
      response: chartSchemaV1,
      what: "The chart",
      badRequest: "the date is outside the supported range.",
    }),
    [TRANSITS_PATH]: buildCalculation({
      operationId: "createTransits",
      summary: "Calculate transits",
      description:
        "The sky at a moment, by default now, against a natal chart: " +
        "where each body is, the natal house it's crossing, and the " +
        "aspects it makes to the natal bodies within 2°, each with " +
        "when it comes into orb, is exact and leaves orb. Positions " +
        "follow the natal chart's zodiac.",
      request: transitsRequestSchemaV1,
      response: transitsSchemaV1,
      what: "The transits",
      badRequest: "the birth date or `at` is outside the supported range.",
    }),
    [PROGRESSIONS_PATH]: buildCalculation({
      operationId: "createProgressions",
      summary: "Calculate secondary progressions",
      description:
        "The chart moved on a day for each year of life, to a date, by " +
        "default today: the progressed bodies, the natal houses they're " +
        "in, and the aspects they make to the natal bodies within 1°.",
      request: progressionsRequestSchemaV1,
      response: progressionsSchemaV1,
      what: "The progressions",
      badRequest:
        "the birth date is outside the supported range, or `date` is " +
        "before it.",
    }),
    [SOLAR_RETURN_PATH]: buildCalculation({
      operationId: "createSolarReturn",
      summary: "Find a solar return",
      description:
        "The chart for the moment, to the second, the Sun gets back to " +
        "its natal position in a year, by default the return in effect " +
        "now, cast for the birthplace or another place. Needs the birth " +
        "time, which fixes the natal Sun.",
      request: solarReturnRequestSchemaV1,
      response: solarReturnSchemaV1,
      what: "The solar return",
      badRequest:
        "the birth time is missing, `year` isn't after the year of " +
        "birth, or a date is outside the supported range.",
    }),
    [LUNAR_RETURN_PATH]: buildCalculation({
      operationId: "createLunarReturn",
      summary: "Find a lunar return",
      description:
        "The chart for the latest moment, to the second, the Moon got " +
        "back to its natal position by the end of a date, by default " +
        "today, cast for the birthplace or another place. Returns come " +
        "about every 27 days. Needs the birth time, which fixes the " +
        "natal Moon.",
      request: lunarReturnRequestSchemaV1,
      response: lunarReturnSchemaV1,
      what: "The lunar return",
      badRequest:
        "the birth time is missing, `date` is before the first return, " +
        "about four weeks after birth, or a date is outside the " +
        "supported range.",
    }),
    [SYNASTRY_PATH]: buildCalculation({
      operationId: "createSynastry",
      summary: "Compare two charts",
      description:
        "Two people's natal charts, the aspects between them, and where " +
        "each person's bodies fall in the other's houses: what the site " +
        "draws as a bi-wheel.",
      request: comparisonRequestSchemaV1,
      response: synastrySchemaV1,
      what: "The comparison",
      badRequest: "either birth date is outside the supported range.",
    }),
    [COMPOSITE_PATH]: buildCalculation({
      operationId: "createComposite",
      summary: "Calculate a composite chart",
      description:
        "One chart for two people: each body at the midpoint of their " +
        "positions, with houses cast around the midpoint of their " +
        "midheavens, when both birth times are known.",
      request: comparisonRequestSchemaV1,
      response: compositeSchemaV1,
      what: "The composite",
      badRequest: "either birth date is outside the supported range.",
    }),
    [PLACES_PATH]: {
      get: {
        operationId: "searchPlaces",
        summary: "Search for a place",
        tags: [TAG_PLACES],
        requestParams: { query: placesQuerySchemaV1 },
        responses: {
          [HTTP_OK]: {
            description: "Matching places. Not paginated.",
            ...buildJsonContent(placesPageSchemaV1),
          },
          [HTTP_BAD_REQUEST]: buildErrorResponse(
            "`q` is missing or `limit` is invalid.",
          ),
        },
      },
    },
  },
};

export const buildOpenApiDocument = () => createDocument(DOCUMENT);
