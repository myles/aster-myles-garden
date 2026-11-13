import mylesOxfmtConfig from "@mylesb/oxfmt-config";
import { defineConfig } from "oxfmt";

// Prettier formats Astro and Svelte files; see prettier.config.mjs.
export default defineConfig({
  ...mylesOxfmtConfig,
  ignorePatterns: ["**/*.astro", "**/*.svelte", "public/data/**"],
  sortTailwindcss: {
    stylesheet: "./src/styles/global.css",
  },
});
