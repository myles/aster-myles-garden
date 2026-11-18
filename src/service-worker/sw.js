// Aster's service worker. Keeps the page, its scripts, styles, fonts and
// the calculation engine in a cache, so a chart can be drawn without a
// connection once the site has been opened. Nothing typed into the page
// is cached: birth details stay in the page and the link's # fragment,
// and the API, which is sent them, is never cached.

// Filled in by the build: see src/integrations/service-worker.ts.
const CACHE_VERSION = "development";
const PRECACHE_PATHS = [];

const PRECACHE_PREFIX = "aster-precache-";
const PRECACHE_NAME = `${PRECACHE_PREFIX}${CACHE_VERSION}`;

// The place index is large, so it's cached the first time a place is
// searched for rather than on install. It isn't tied to a release, so
// its cache isn't versioned; each use refreshes it in the background.
const RUNTIME_NAME = "aster-runtime";
const RUNTIME_PATHS = new Set([
  "/data/places-top.json",
  "/data/places-all.json",
]);

const PAGE_PATH = "/";
const API_PREFIX = "/api/";

/**
 * Scripts and fonts are fetched with CORS, so their requests carry an
 * Origin header the cached copies were stored without. Servers answer
 * with "Vary: Origin", which would make every such lookup miss. Precached
 * files are fixed for a release, so Vary can be ignored.
 */
const PRECACHE_MATCH_OPTIONS = { ignoreVary: true };

/** How long to wait for the page from the network before using the cache. */
const PAGE_TIMEOUT_MS = 3000;

self.addEventListener("install", (event) => {
  // Take over straight away: pages come from the network first, so an
  // open page is never left asking for files the new cache has dropped.
  event.waitUntil(
    caches
      .open(PRECACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_PATHS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([deleteOldPrecaches(), deleteOldRuntimeEntries()]).then(() =>
      self.clients.claim(),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  const isOwnGet =
    request.method === "GET" && url.origin === self.location.origin;
  if (!isOwnGet || url.pathname.startsWith(API_PREFIX)) {
    return;
  }

  if (request.mode === "navigate" && url.pathname === PAGE_PATH) {
    event.respondWith(fetchPage(request));
    return;
  }

  if (RUNTIME_PATHS.has(url.pathname)) {
    event.respondWith(fetchAndRefresh(event, request));
    return;
  }

  if (PRECACHE_PATHS.includes(url.pathname)) {
    event.respondWith(fetchFromPrecache(request));
  }
});

async function deleteOldPrecaches() {
  const names = await caches.keys();
  const old = names.filter(
    (name) => name.startsWith(PRECACHE_PREFIX) && name !== PRECACHE_NAME,
  );

  await Promise.all(old.map((name) => caches.delete(name)));
}

/**
 * Runtime files this release no longer asks for, such as a place index
 * whose name changed with its layout. They'd otherwise stay cached.
 */
async function deleteOldRuntimeEntries() {
  const cache = await caches.open(RUNTIME_NAME);
  const requests = await cache.keys();
  const old = requests.filter(
    (request) => !RUNTIME_PATHS.has(new URL(request.url).pathname),
  );

  await Promise.all(old.map((request) => cache.delete(request)));
}

/**
 * The page from the network, so it's always current when online, or the
 * cached one when the network fails or is slow. A fresh page isn't cached:
 * it may need files this release's cache doesn't have.
 */
async function fetchPage(request) {
  try {
    return await rejectAfter(fetch(request), PAGE_TIMEOUT_MS);
  } catch (error) {
    const cached = await matchPrecache(PAGE_PATH);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

/** Hashed assets never change, so the cached copy is always right. */
async function fetchFromPrecache(request) {
  const cached = await matchPrecache(request);
  return cached ?? fetch(request);
}

async function matchPrecache(request) {
  const cache = await caches.open(PRECACHE_NAME);
  return cache.match(request, PRECACHE_MATCH_OPTIONS);
}

/** The cached copy at once, refreshed in the background for next time. */
async function fetchAndRefresh(event, request) {
  const cache = await caches.open(RUNTIME_NAME);
  const cached = await cache.match(request);
  const refresh = fetch(request).then(async (response) => {
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  });

  if (!cached) {
    return refresh;
  }

  // The cached copy has already answered, so a failed refresh only means
  // the visitor is offline. Log it rather than fail the request.
  event.waitUntil(
    refresh.catch((error) => {
      console.warn(`Couldn't refresh ${request.url}:`, error);
    }),
  );
  return cached;
}

function rejectAfter(promise, timeoutMs) {
  const timeout = new Promise((_resolve, reject) => {
    setTimeout(
      () => reject(new Error(`No response in ${timeoutMs} ms`)),
      timeoutMs,
    );
  });

  return Promise.race([promise, timeout]);
}
