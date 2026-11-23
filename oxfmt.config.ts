import mylesOxfmtConfig from "@mylesb/oxfmt-config";
import { defineConfig } from "oxfmt";

// Prettier formats Astro and Svelte files; see prettier.config.mjs.
export default defineConfig({
  ...mylesOxfmtConfig,
  // release-please writes CHANGELOG.md in its own style, and would undo
  // any formatting on its next release. `lex install` writes lexicons/
  // verbatim from the network.
  ignorePatterns: [
    "**/*.astro",
    "**/*.svelte",
    "public/data/**",
    "CHANGELOG.md",
    "lexicons/**",
  ],
  sortTailwindcss: {
    stylesheet: "./src/styles/global.css",
  },
});
