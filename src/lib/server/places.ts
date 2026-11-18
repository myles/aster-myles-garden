// The GeoNames place index, for the API. The browser fetches this same
// file from the site, after the smaller top one; the server bundles it, so a search never makes a
// network request.

import {
  parsePlaceIndex,
  type PlaceIndex,
  type RawPlaceIndex,
} from "@/lib/places";

import rawPlaceIndex from "../../../public/data/places-all.json";

let _index: PlaceIndex | undefined;

/** Parses the index on first use; later calls reuse it. */
export function getPlaceIndex(): PlaceIndex {
  _index ??= parsePlaceIndex(rawPlaceIndex as RawPlaceIndex);
  return _index;
}
