// The OpenAPI document for /api/v1, generated from the same schemas that
// guard the routes. createDocument throws on anything it can't represent,
// so a schema it can't describe fails the build and the tests.

import type { z } from "astro/zod";

import { createDocument, type ZodOpenApiObject } from "zod-openapi";

import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL, SOURCE_URL } from "@/consts";

import { HTTP_BAD_REQUEST, HTTP_INTERNAL_SERVER_ERROR, HTTP_OK } from "./http";
import { CHART_PATH, PLACES_PATH, TRANSITS_PATH } from "./paths";
import {
  chartRequestSchemaV1,
  chartSchemaV1,
  errorSchemaV1,
  placesPageSchemaV1,
  placesQuerySchemaV1,
  transitsRequestSchemaV1,
  transitsSchemaV1,
} from "./schemas";

const OPENAPI_VERSION = "3.1.0";
const API_VERSION = "1.0.0";
const JSON_MEDIA_TYPE = "application/json";
const LICENSE_NAME = "AGPL-3.0-only";
const AUTHOR_NAME = "Myles Braithwaite";

export { CHART_PATH, PLACES_PATH, TRANSITS_PATH } from "./paths";

const TAG_CHARTS = "Charts";
const TAG_PLACES = "Places";

const buildJsonContent = (schema: z.ZodType) => ({
  content: { [JSON_MEDIA_TYPE]: { schema } },
});

const buildErrorResponse = (description: string) => ({
  description,
  ...buildJsonContent(errorSchemaV1),
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
    [CHART_PATH]: {
      post: {
        operationId: "createChart",
        summary: "Calculate a natal chart",
        description:
          "Positions, houses and aspects for a birth date, local time and " +
          "place. Without a time, the chart is cast for local noon and " +
          "has no houses or angles. Above the polar circles, Placidus " +
          "and Koch can't be cast, so the houses fall back to Porphyry " +
          "and `effectiveHouseSystem` says so. Positions are in the " +
          "tropical zodiac unless an `ayanamsa` is given for the sidereal.",
        tags: [TAG_CHARTS],
        requestBody: {
          required: true,
          ...buildJsonContent(chartRequestSchemaV1),
        },
        responses: {
          [HTTP_OK]: {
            description: "The chart.",
            ...buildJsonContent(chartSchemaV1),
          },
          [HTTP_BAD_REQUEST]: buildErrorResponse(
            "The body isn't JSON, a field is invalid, or the date is " +
              "outside the supported range.",
          ),
          [HTTP_INTERNAL_SERVER_ERROR]: buildErrorResponse(
            "The chart couldn't be calculated.",
          ),
        },
      },
    },
    [TRANSITS_PATH]: {
      post: {
        operationId: "createTransits",
        summary: "Calculate transits",
        description:
          "The sky at a moment, by default now, against a natal chart: " +
          "where each body is, the natal house it's crossing, and the " +
          "aspects it makes to the natal bodies within 2°, each with " +
          "when it comes into orb, is exact and leaves orb. Positions " +
          "follow the natal chart's zodiac.",
        tags: [TAG_CHARTS],
        requestBody: {
          required: true,
          ...buildJsonContent(transitsRequestSchemaV1),
        },
        responses: {
          [HTTP_OK]: {
            description: "The transits.",
            ...buildJsonContent(transitsSchemaV1),
          },
          [HTTP_BAD_REQUEST]: buildErrorResponse(
            "The body isn't JSON, a field is invalid, or the birth date " +
              "or `at` is outside the supported range.",
          ),
          [HTTP_INTERNAL_SERVER_ERROR]: buildErrorResponse(
            "The transits couldn't be calculated.",
          ),
        },
      },
    },
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
