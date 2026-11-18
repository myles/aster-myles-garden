// Measures how long the place indexes take to become searchable in a
// browser, on this machine and throttled to a phone's CPU and network,
// so a change to their size or shape can be checked.
//
// Usage:
//   node scripts/places-measure.mjs
//
// Set CHROMIUM_PATH to use a Chromium other than Playwright's own.
//
// It serves public/data's indexes brotli-compressed, as the host does,
// and loads the top one, then the whole one, with the site's own code from
// src/lib/places.ts, as the place field does, in headless Chromium.
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

const INDEX_FILES = ["places-top.json", "places-all.json"];
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

const files = new Map(
  INDEX_FILES.map((name) => {
    const raw = readFileSync(`public/data/${name}`);
    const compressed = brotliCompressSync(raw, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
    });
    return [`/data/${name}`, { name, raw, compressed }];
  }),
);

const bundle = await build({
  input: "src/lib/places.ts",
  resolve: { tsconfigFilename: "tsconfig.json" },
  write: false,
  output: { format: "iife", name: "places" },
});
const script = bundle.output[0].code;

const page = `<!doctype html><meta charset="utf-8"><script>${script}</script>`;

const server = createServer((request, response) => {
  const file = files.get(request.url);
  if (file) {
    response.writeHead(200, {
      "Content-Type": "application/json",
      "Content-Encoding": "br",
      "Cache-Control": "no-store",
    });
    response.end(file.compressed);
    return;
  }
  response.writeHead(200, { "Content-Type": "text/html" });
  response.end(page);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

/**
 * Runs in the page: when each index can first be searched, and how long
 * each query takes on it, in milliseconds.
 */
async function measureInPage(queries) {
  const start = performance.now();
  const time = (load) =>
    load().then((index) => ({
      ready: performance.now() - start,
      searches: queries.map((query) => {
        const before = performance.now();
        globalThis.places.searchPlaces(index, query);
        return performance.now() - before;
      }),
    }));

  const top = await time(globalThis.places.loadTopPlaceIndex);
  const all = await time(globalThis.places.loadPlaceIndex);
  return { top, all };
}

const median = (values) => {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const format = (ms) => `${Math.round(ms)} ms`.padStart(9);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
});
for (const { name, raw, compressed } of files.values()) {
  console.log(
    `${name}: ${(raw.length / 1e6).toFixed(2)} MB, ` +
      `${(compressed.length / 1e3).toFixed(0)} KB brotli`,
  );
}
console.log(`Median of ${RUNS} cold loads, the top index first.\n`);

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
  for (const [label, key] of [
    ["Biggest cities", "top"],
    ["Every place", "all"],
  ]) {
    console.log(
      `  ${label.padEnd(15)} ready ${format(pick((r) => r[key].ready))}`,
    );
    QUERIES.forEach((query, i) => {
      const quoted = `"${query}"`.padEnd(16);
      console.log(
        `    Search ${quoted}${format(pick((r) => r[key].searches[i]))}`,
      );
    });
  }
  console.log("");
}

await browser.close();
server.close();
