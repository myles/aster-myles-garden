// Pages for working on the site, served by `npm run dev` and never built:
// a production build doesn't know they exist, so they can't ship.

import type { AstroIntegration } from "astro";

/** Each page's route, and the file under src/dev/ that draws it. */
export const DEV_PAGES = [
  { pattern: "/dev/components", entrypoint: "./src/dev/components.astro" },
];

export function devPages(): AstroIntegration {
  return {
    name: "aster:dev-pages",
    hooks: {
      "astro:config:setup": ({ command, injectRoute }) => {
        if (command !== "dev") {
          return;
        }

        for (const page of DEV_PAGES) {
          injectRoute({ ...page, prerender: false });
        }
      },
    },
  };
}
