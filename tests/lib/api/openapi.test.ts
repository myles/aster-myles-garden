import { describe, expect, it } from "vitest";

import {
  buildOpenApiDocument,
  CHART_PATH,
  PLACES_PATH,
  TRANSITS_PATH,
} from "@/lib/api/openapi";

describe("buildOpenApiDocument", () => {
  const document = buildOpenApiDocument();

  it("describes every endpoint", () => {
    expect(Object.keys(document.paths ?? {})).toEqual([
      CHART_PATH,
      TRANSITS_PATH,
      PLACES_PATH,
    ]);
    expect(document.paths?.[CHART_PATH]?.post?.operationId).toBe("createChart");
    expect(document.paths?.[TRANSITS_PATH]?.post?.operationId).toBe(
      "createTransits",
    );
    expect(document.paths?.[PLACES_PATH]?.get?.operationId).toBe(
      "searchPlaces",
    );
  });

  it("names the shared shapes as components", () => {
    expect(Object.keys(document.components?.schemas ?? {})).toEqual(
      expect.arrayContaining([
        "Ayanamsa",
        "Chart",
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
