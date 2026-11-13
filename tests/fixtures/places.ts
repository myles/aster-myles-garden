import { parsePlaceIndex, type PlaceIndex } from "@/lib/places";

export const PLACE_INDEX: PlaceIndex = parsePlaceIndex({
  timeZones: ["Europe/London", "America/Toronto"],
  places: [
    [
      "London",
      "",
      "England",
      "United Kingdom",
      51.5085,
      -0.1257,
      0,
      8961989,
      2643743,
    ],
    [
      "Toronto",
      "",
      "Ontario",
      "Canada",
      43.7064,
      -79.3986,
      1,
      2600000,
      6167865,
    ],
    ["London", "", "Ontario", "Canada", 42.9834, -81.233, 1, 346765, 6058560],
  ],
});
