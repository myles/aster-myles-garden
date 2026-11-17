import svelte from "@astrojs/svelte";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

import { SITE_URL } from "./src/consts";
import { devPages } from "./src/integrations/dev-pages";
import { serviceWorker } from "./src/integrations/service-worker";

/**
 * Emscripten's UMD footer in @swisseph/browser checks `typeof module`.
 * It never runs in a browser, so the bundler's warning about it is noise.
 */
const SWISSEPH_MODULE_PATH = "@swisseph/browser/dist/swisseph.js";
const COMMONJS_IN_ESM_LOG_CODE = "COMMONJS_VARIABLE_IN_ESM";

/**
 * The API's native Swiss Ephemeris binding. File tracing only finds the
 * prebuild for the machine that builds, so Vercel's Linux one is added by
 * hand: a build on a Mac would otherwise ship only darwin-arm64.
 */
const SWISSEPH_NODE_PACKAGE = "@swisseph/node";
const SWISSEPH_NODE_VERCEL_PREBUILD =
  "node_modules/@swisseph/node/prebuilds/linux-x64/swisseph.node";

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,

  vite: {
    plugins: [tailwindcss()],
    // A native addon, loaded from its package's prebuilds/ at runtime, so
    // it stays out of the bundle for Vercel to trace as a file.
    ssr: { external: [SWISSEPH_NODE_PACKAGE] },
    build: {
      rolldownOptions: {
        onLog(level, log, handler) {
          const isSwissephFooter =
            log.code === COMMONJS_IN_ESM_LOG_CODE &&
            log.id?.endsWith(SWISSEPH_MODULE_PATH);

          if (isSwissephFooter) {
            return;
          }

          handler(level, log);
        },
      },
    },
  },

  integrations: [svelte(), serviceWorker(), devPages()],
  adapter: vercel({ includeFiles: [SWISSEPH_NODE_VERCEL_PREBUILD] }),
});
