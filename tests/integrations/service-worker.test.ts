import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  hashPrecache,
  listPrecachePaths,
  renderServiceWorker,
  SERVICE_WORKER_TEMPLATE_PATH,
} from "@/integrations/service-worker";

let clientDir: string;

async function writeClientFile(path: string, contents = path): Promise<void> {
  const fullPath = join(clientDir, path);
  await mkdir(join(fullPath, ".."), { recursive: true });
  await writeFile(fullPath, contents);
}

beforeEach(async () => {
  clientDir = await mkdtemp(join(tmpdir(), "aster-sw-"));
});

afterEach(async () => {
  await rm(clientDir, { recursive: true });
});

describe("listPrecachePaths", () => {
  it("lists the page and its assets, with the page as /", async () => {
    await writeClientFile("index.html");
    await writeClientFile("_astro/App.abc123.js");
    await writeClientFile("_astro/swisseph.def456.wasm");
    await writeClientFile("icon-192.png");
    await writeClientFile("site.webmanifest");

    expect(await listPrecachePaths(clientDir)).toEqual([
      "/",
      "/_astro/App.abc123.js",
      "/_astro/swisseph.def456.wasm",
      "/icon-192.png",
      "/site.webmanifest",
    ]);
  });

  it("lists other pages by their folder", async () => {
    await writeClientFile("index.html");
    await writeClientFile("guide/index.html");

    expect(await listPrecachePaths(clientDir)).toEqual(["/", "/guide/"]);
  });

  it("leaves out the API, place index and other sites' files", async () => {
    await writeClientFile("index.html");
    await writeClientFile("api/v1/openapi.json");
    await writeClientFile("data/places-all.json");
    await writeClientFile("data/places-top.json");
    await writeClientFile("og-image.jpg");
    await writeClientFile("x-card.jpg");
    await writeClientFile("llms.txt");
    await writeClientFile("ai.txt");
    await writeClientFile("sw.js");

    expect(await listPrecachePaths(clientDir)).toEqual(["/"]);
  });
});

describe("hashPrecache", () => {
  it("changes when any precached file changes", async () => {
    await writeClientFile("index.html", "one");
    const before = await hashPrecache(clientDir, ["/"]);

    await writeClientFile("index.html", "two");

    expect(await hashPrecache(clientDir, ["/"])).not.toBe(before);
  });

  it("reads a folder's page from its index.html", async () => {
    await writeClientFile("guide/index.html", "one");
    const before = await hashPrecache(clientDir, ["/guide/"]);

    await writeClientFile("guide/index.html", "two");

    expect(await hashPrecache(clientDir, ["/guide/"])).not.toBe(before);
  });

  it("is the same for the same files", async () => {
    await writeClientFile("index.html");

    expect(await hashPrecache(clientDir, ["/"])).toBe(
      await hashPrecache(clientDir, ["/"]),
    );
  });
});

describe("renderServiceWorker", () => {
  it("fills in the version and the paths", async () => {
    const template = await readFile(SERVICE_WORKER_TEMPLATE_PATH, "utf8");
    const worker = renderServiceWorker(template, "abc123", ["/", "/a.js"]);

    expect(worker).toContain('const CACHE_VERSION = "abc123";');
    expect(worker).toContain('const PRECACHE_PATHS = ["/","/a.js"];');
  });

  it("refuses a template it can't fill in", () => {
    expect(() => renderServiceWorker("self.x = 1;", "abc123", ["/"])).toThrow(
      "CACHE_VERSION",
    );
  });
});
