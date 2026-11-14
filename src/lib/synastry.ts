// Compares two natal charts: the aspects between them, and where each
// person's planets fall in the other's houses.

import type { Chart } from "@/lib/chart";

import { findAspectsBetween, type Aspect } from "@/lib/aspects";
import { placeInHouses, type HouseOverlay } from "@/lib/houses";

export type Synastry = {
  /** "You": the inner chart of the bi-wheel. */
  first: Chart;
  /** "Them": the outer ring of the bi-wheel. */
  second: Chart;
  /** Each aspect's first body is from `first`, its second from `second`. */
  aspects: Aspect[];
  /** Undefined when the first chart has no birth time, so no houses. */
  secondInFirstHouses?: HouseOverlay;
  /** Undefined when the second chart has no birth time, so no houses. */
  firstInSecondHouses?: HouseOverlay;
};

export function compareCharts(first: Chart, second: Chart): Synastry {
  return {
    first,
    second,
    aspects: findAspectsBetween(
      first.bodies,
      second.bodies,
      first.details.aspectSettings,
    ),
    secondInFirstHouses: placeInHouses(second.bodies, first.houses),
    firstInSecondHouses: placeInHouses(first.bodies, second.houses),
  };
}
