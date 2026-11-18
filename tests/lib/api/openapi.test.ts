import { describe, expect, it } from "vitest";

import {
  buildOpenApiDocument,
  CHART_PATH,
  COMPOSITE_PATH,
  LUNAR_RETURN_PATH,
  PLACES_PATH,
  PROGRESSIONS_PATH,
  SOLAR_RETURN_PATH,
  SYNASTRY_PATH,
  TRANSITS_PATH,
} from "@/lib/api/openapi";

describe("buildOpenApiDocument", () => {
  const document = buildOpenApiDocument();

  it("describes every endpoint", () => {
    expect(Object.keys(document.paths ?? {})).toEqual([
      CHART_PATH,
      TRANSITS_PATH,
      PROGRESSIONS_PATH,
      SOLAR_RETURN_PATH,
      LUNAR_RETURN_PATH,
      SYNASTRY_PATH,
      COMPOSITE_PATH,
      PLACES_PATH,
    ]);
    expect(document.paths?.[PLACES_PATH]?.get?.operationId).toBe(
      "searchPlaces",
    );
  });

  it.each([
    [CHART_PATH, "createChart"],
    [TRANSITS_PATH, "createTransits"],
    [PROGRESSIONS_PATH, "createProgressions"],
    [SOLAR_RETURN_PATH, "createSolarReturn"],
    [LUNAR_RETURN_PATH, "createLunarReturn"],
    [SYNASTRY_PATH, "createSynastry"],
    [COMPOSITE_PATH, "createComposite"],
  ])("describes POST %s as %s", (path, operationId) => {
    const post = document.paths?.[path]?.post;

    expect(post?.operationId).toBe(operationId);
    expect(Object.keys(post?.responses ?? {})).toEqual(["200", "400", "500"]);
  });

  it("refers to a nested chart, rather than repeating it", () => {
    const synastry = document.components?.schemas?.Synastry;
    const properties =
      typeof synastry === "object" && "properties" in synastry
        ? synastry.properties
        : {};

    expect(properties?.first).toEqual({ $ref: "#/components/schemas/Chart" });
  });

  it("names the shared shapes as components", () => {
    expect(Object.keys(document.components?.schemas ?? {})).toEqual(
      expect.arrayContaining([
        "Ayanamsa",
        "Chart",
        "ComparisonRequest",
        "Composite",
        "LunarReturn",
        "Person",
        "PlaceRequest",
        "Progressions",
        "SolarReturn",
        "Synastry",
        "ChartRequest",
        "Error",
        "HouseSystem",
        "Place",
        "PlacesPage",
        "TimedAspect",
        "Transits",
        "TransitsRequest",
      ]),
    );
  });

  it("documents the places query parameters", () => {
    const parameters = document.paths?.[PLACES_PATH]?.get?.parameters ?? [];
    const names = parameters.map((parameter) =>
      "name" in parameter ? parameter.name : undefined,
    );

    expect(names).toEqual(["q", "limit"]);
  });
});
