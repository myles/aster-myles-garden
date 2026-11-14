// Writes the offline service worker into the build. Lists the files the
// page needs, stamps the worker with them and a version made from their
// contents, and saves it as /sw.js beside them. A new release changes the
// version, so visitors' browsers fetch the new files and drop the old.

import type { AstroIntegration } from "astro";

import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const SERVICE_WORKER_TEMPLATE_PATH = fileURLToPath(
  new URL("../service-worker/sw.js", import.meta.url),
);
const SERVICE_WORKER_FILENAME = "sw.js";

const PAGE_FILENAME = "index.html";
const PAGE_PATH = "/";

/**
 * Built files left out of the precache, by path prefix: the API, which is
 * never cached; the place index, cached on first use since it's large;
 * and files for other sites and tools rather than the page.
 */
const UNCACHED_PATH_PREFIXES = [
  "/api/",
  "/data/",
  "/og-image.jpg",
  "/x-card.jpg",
  "/llms.txt",
  "/ai.txt",
  `/${SERVICE_WORKER_FILENAME}`,
];

const VERSION_HASH_CHARS = 12;

// The lines in the template the build replaces. Example output:
// const CACHE_VERSION = "3f9a0c1b2d4e";
const VERSION_LINE = 'const CACHE_VERSION = "development";';
const PATHS_LINE = "const PRECACHE_PATHS = [];";

/** Every built file the page needs offline, as URL paths, sorted. */
export async function listPrecachePaths(clientDir: string): Promise<string[]> {
  const entries = await readdir(clientDir, {
    recursive: true,
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => toUrlPath(clientDir, join(entry.parentPath, entry.name)))
    .filter(
      (path) =>
        !UNCACHED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix)),
    )
    .toSorted();
}

/** A short hash of every precached file's path and contents. */
export async function hashPrecache(
  clientDir: string,
  paths: string[],
): Promise<string> {
  const contents = await Promise.all(
    paths.map((path) => readFile(toFilePath(clientDir, path))),
  );
  const hash = createHash("sha256");

  paths.forEach((path, index) => {
    hash.update(path);
    hash.update(contents[index]);
  });

  return hash.digest("hex").slice(0, VERSION_HASH_CHARS);
}

/** Throws when the template lacks a line the build fills in. */
export function renderServiceWorker(
  template: string,
  version: string,
  paths: string[],
): string {
  for (const line of [VERSION_LINE, PATHS_LINE]) {
    if (!template.includes(line)) {
      throw new Error(`The service worker template has no "${line}" line.`);
    }
  }

  return template
    .replace(VERSION_LINE, `const CACHE_VERSION = ${JSON.stringify(version)};`)
    .replace(PATHS_LINE, `const PRECACHE_PATHS = ${JSON.stringify(paths)};`);
}

async function writeServiceWorker(clientDir: string): Promise<number> {
  const paths = await listPrecachePaths(clientDir);
  const version = await hashPrecache(clientDir, paths);
  const template = await readFile(SERVICE_WORKER_TEMPLATE_PATH, "utf8");

  await writeFile(
    join(clientDir, SERVICE_WORKER_FILENAME),
    renderServiceWorker(template, version, paths),
  );

  return paths.length;
}

/** "_astro/App.js" → "/_astro/App.js"; "index.html" → "/". */
function toUrlPath(clientDir: string, filePath: string): string {
  const path = `/${relative(clientDir, filePath).split(sep).join("/")}`;
  return path === `/${PAGE_FILENAME}` ? PAGE_PATH : path;
}

function toFilePath(clientDir: string, urlPath: string): string {
  const path = urlPath === PAGE_PATH ? PAGE_FILENAME : urlPath.slice(1);
  return join(clientDir, ...path.split("/"));
}

export function serviceWorker(): AstroIntegration {
  let clientDir: string | undefined;

  return {
    name: "aster:service-worker",
    hooks: {
      // Static files land in the client folder, or in outDir when nothing
      // is rendered on a server.
      "astro:config:done": ({ config, buildOutput }) => {
        const dir =
          buildOutput === "static" ? config.outDir : config.build.client;
        clientDir = fileURLToPath(dir);
      },
      "astro:build:done": async ({ logger }) => {
        if (!clientDir) {
          throw new Error("The build finished before its config was read.");
        }

        const count = await writeServiceWorker(clientDir);
        logger.info(
          `Wrote ${SERVICE_WORKER_FILENAME}, precaching ${count} files`,
        );
      },
    },
  };
}
