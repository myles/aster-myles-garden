// Measures how long the place index takes to become searchable in a
// browser, on this machine and throttled to a phone's CPU and network,
// so a change to the index's size or shape can be checked.
//
// Usage:
//   node scripts/places-measure.mjs [path/to/places.json]
//
// Set CHROMIUM_PATH to use a Chromium other than Playwright's own.
//
// It serves the index brotli-compressed, as the host does, and runs the
// site's own search code from src/lib/places.ts in headless Chromium.
// CPU throttling slows this machine down, so the phone numbers are only
// as good as the machine they're scaled from: compare runs on one machine.

// Runs are timed one after another on purpose: run side by side, they'd
// share the CPU and slow each other down.
/* oxlint-disable no-await-in-loop */

import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { brotliCompressSync, constants } from "node:zlib";
import { chromium } from "playwright";
import { build } from "rolldown";

const INDEX_PATH = process.argv[2] ?? "public/data/places.json";
const RUNS = 5;

/** Lighthouse's mobile network: "Slow 4G", 150 ms and 1.6 Mbit/s. */
const SLOW_4G = { latency: 150, downloadKbps: 1638.4, uploadKbps: 750 };

const PROFILES = [
  { name: "This machine", cpu: 1, network: undefined },
  { name: "Mid-range phone (4× CPU, Slow 4G)", cpu: 4, network: SLOW_4G },
  { name: "Low-end phone (6× CPU, Slow 4G)", cpu: 6, network: SLOW_4G },
];

/** A common query, one that narrows, and one that scans every place. */
const QUERIES = ["tor", "london, canada", "zzzz"];

const raw = readFileSync(INDEX_PATH);
const compressed = brotliCompressSync(raw, {
  params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
});

const bundle = await build({
  input: "src/lib/places.ts",
  resolve: { tsconfigFilename: "tsconfig.json" },
  write: false,
  output: { format: "iife", name: "places" },
});
const script = bundle.output[0].code;

const page = `<!doctype html><meta charset="utf-8"><script>${script}</script>`;

const server = createServer((request, response) => {
  if (request.url === "/data/places.json") {
    response.writeHead(200, {
      "Content-Type": "application/json",
      "Content-Encoding": "br",
      "Cache-Control": "no-store",
    });
    response.end(compressed);
    return;
  }
  response.writeHead(200, { "Content-Type": "text/html" });
  response.end(page);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

/** Runs in the page: each step of a first search, in milliseconds. */
async function measureInPage(queries) {
  const start = performance.now();
  const response = await fetch("/data/places.json");
  const text = await response.text();
  const fetched = performance.now();
  const json = JSON.parse(text);
  const parsedJson = performance.now();
  const index = globalThis.places.parsePlaceIndex(json);
  const indexed = performance.now();

  const searches = queries.map((query) => {
    const before = performance.now();
    globalThis.places.searchPlaces(index, query);
    return performance.now() - before;
  });

  return {
    download: fetched - start,
    jsonParse: parsedJson - fetched,
    indexBuild: indexed - parsedJson,
    searches,
    total: indexed - start + searches[0],
  };
}

const median = (values) => {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const format = (ms) => `${Math.round(ms)} ms`.padStart(9);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
});
console.log(
  `Index: ${(raw.length / 1e6).toFixed(2)} MB, ` +
    `${(compressed.length / 1e6).toFixed(2)} MB brotli. ` +
    `Median of ${RUNS} cold loads.\n`,
);

for (const profile of PROFILES) {
  const runs = [];
  for (let run = 0; run < RUNS; run++) {
    // A fresh context each run: nothing cached, a cold heap.
    const context = await browser.newContext();
    const tab = await context.newPage();
    const cdp = await context.newCDPSession(tab);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });
    if (profile.network) {
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: profile.network.latency,
        downloadThroughput: (profile.network.downloadKbps * 1024) / 8,
        uploadThroughput: (profile.network.uploadKbps * 1024) / 8,
      });
    }
    await tab.goto(origin);
    runs.push(await tab.evaluate(measureInPage, QUERIES));
    await context.close();
  }

  const pick = (read) => median(runs.map(read));
  console.log(profile.name);
  console.log(`  Download   ${format(pick((r) => r.download))}`);
  console.log(`  JSON.parse ${format(pick((r) => r.jsonParse))}`);
  console.log(`  Indexing   ${format(pick((r) => r.indexBuild))}`);
  QUERIES.forEach((query, i) => {
    const label = `"${query}"`.padEnd(16);
    console.log(`  Search ${label}${format(pick((r) => r.searches[i]))}`);
  });
  console.log(`  First result ${format(pick((r) => r.total))}\n`);
}

await browser.close();
server.close();
