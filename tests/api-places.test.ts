import { describe, expect, it } from "vitest";

import { CACHE_PUBLIC_DAY } from "@/lib/api/http";
import { formatPlaceForApi, handlePlacesRequest } from "@/lib/api/places";
import { findPlace } from "@/lib/places";

import { PLACE_INDEX } from "./fixtures/places";

const LONDON_ONTARIO_ID = 6058560;

const PLACES_URL = "https://aster.myles.garden/api/v1/places";

function getPlaces(query: string): Response {
  return handlePlacesRequest(new Request(`${PLACES_URL}?${query}`));
}

describe("formatPlaceForApi", () => {
  it("adds a label", () => {
    const place = findPlace(PLACE_INDEX, LONDON_ONTARIO_ID)!;

    expect(formatPlaceForApi(place)).toEqual({
      ...place,
      label: "London, Ontario, Canada",
    });
  });
});

describe("handlePlacesRequest", () => {
  it("searches the bundled index", async () => {
    const response = getPlaces("q=london%2C%20canada&limit=2");
    const page = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(CACHE_PUBLIC_DAY);
    expect(page).toMatchObject({ next: null, previous: null, count: 1 });
    expect(page.result[0]).toMatchObject({
      id: LONDON_ONTARIO_ID,
      label: "London, Ontario, Canada",
      timeZone: "America/Toronto",
    });
  });

  it("caps the results at the limit", async () => {
    const page = await getPlaces("q=san&limit=3").json();

    expect(page.count).toBe(3);
    expect(page.result).toHaveLength(3);
  });

  it.each([
    ["a missing query", ""],
    ["a limit over the maximum", "q=london&limit=100"],
  ])("answers %s with a 400", async (_label, query) => {
    const response = getPlaces(query);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String) });
  });
});
