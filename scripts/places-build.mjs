// Builds the offline place index used by the birth form's place search.
//
// Reads GeoNames dumps (https://download.geonames.org/export/dump/) and
// writes a compact JSON file, so place lookup never leaves the browser.
// GeoNames data is CC BY 4.0 — keep the attribution in the site footer.
//
// Usage:
//   node scripts/places-build.mjs <geonames-dir>
//
// <geonames-dir> must contain cities15000.txt, admin1CodesASCII.txt and
// countryInfo.txt.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUTPUT_PATH = "public/data/places.json";
const COORDINATE_DECIMALS = 4;

// Column indices in the GeoNames "geoname" table.
const COL_GEONAME_ID = 0;
const COL_NAME = 1;
const COL_ASCII_NAME = 2;
const COL_LATITUDE = 4;
const COL_LONGITUDE = 5;
const COL_COUNTRY_CODE = 8;
const COL_ADMIN1_CODE = 10;
const COL_POPULATION = 14;
const COL_TIME_ZONE = 17;

function readRows(path) {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("\t"));
}

function loadCountryNames(dir) {
  const rows = readRows(join(dir, "countryInfo.txt"));
  return new Map(rows.map((row) => [row[0], row[4]]));
}

function loadAdmin1Names(dir) {
  const rows = readRows(join(dir, "admin1CodesASCII.txt"));
  return new Map(rows.map((row) => [row[0], row[1]]));
}

function buildPlaces(dir) {
  const countryNames = loadCountryNames(dir);
  const admin1Names = loadAdmin1Names(dir);
  const timeZones = [];
  const timeZoneIndices = new Map();

  const rows = readRows(join(dir, "cities15000.txt"));
  const places = [];

  for (const row of rows) {
    const timeZone = row[COL_TIME_ZONE];
    if (!timeZone) {
      continue;
    }

    if (!timeZoneIndices.has(timeZone)) {
      timeZoneIndices.set(timeZone, timeZones.length);
      timeZones.push(timeZone);
    }

    const name = row[COL_NAME];
    const asciiName = row[COL_ASCII_NAME];
    const countryCode = row[COL_COUNTRY_CODE];
    const admin1Key = `${countryCode}.${row[COL_ADMIN1_CODE]}`;

    places.push([
      name,
      // Only stored when it differs, to keep the file small.
      asciiName === name ? "" : asciiName,
      admin1Names.get(admin1Key) ?? "",
      countryNames.get(countryCode) ?? countryCode,
      Number(Number(row[COL_LATITUDE]).toFixed(COORDINATE_DECIMALS)),
      Number(Number(row[COL_LONGITUDE]).toFixed(COORDINATE_DECIMALS)),
      timeZoneIndices.get(timeZone),
      Number(row[COL_POPULATION]),
      // Stable across rebuilds, so shared links can name a place by it.
      Number(row[COL_GEONAME_ID]),
    ]);
  }

  // Most populous first, so search results rank sensibly without sorting.
  places.sort((a, b) => b[7] - a[7]);

  return { timeZones, places };
}

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: node scripts/places-build.mjs <geonames-dir>");
  process.exit(1);
}

const index = buildPlaces(dir);
writeFileSync(OUTPUT_PATH, JSON.stringify(index));
console.log(`Wrote ${index.places.length} places to ${OUTPUT_PATH}`);
