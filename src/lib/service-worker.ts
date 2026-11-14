// Registers the offline service worker the build writes to /sw.js. The
// container is passed in, so callers choose it and tests can fake it.

export const SERVICE_WORKER_URL = "/sw.js";

/**
 * Registers the worker where the browser supports it: undefined means it
 * doesn't, as on a page served without HTTPS. The site still works online
 * without a worker, so a failure is logged rather than thrown.
 */
export async function registerServiceWorker(
  container: ServiceWorkerContainer | undefined,
): Promise<void> {
  if (!container) {
    return;
  }

  try {
    await container.register(SERVICE_WORKER_URL);
  } catch (error) {
    console.error("Couldn't set Aster up to work offline:", error);
  }
}
