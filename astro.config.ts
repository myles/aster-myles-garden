import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

import { SITE_URL } from "./src/consts";

/**
 * Emscripten's UMD footer in @swisseph/browser checks `typeof module`.
 * It never runs in a browser, so the bundler's warning about it is noise.
 */
const SWISSEPH_MODULE_PATH = "@swisseph/browser/dist/swisseph.js";
const COMMONJS_IN_ESM_LOG_CODE = "COMMONJS_VARIABLE_IN_ESM";

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,

  vite: {
    plugins: [tailwindcss()],
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

  integrations: [svelte()],
});
