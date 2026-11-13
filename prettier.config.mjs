import mylesPrettierConfig from "@mylesb/prettier-config";

// Prettier handles Astro and Svelte; oxfmt formats the remaining files.
/** @type {import("prettier").Config} */
export default {
  ...mylesPrettierConfig,
  plugins: [
    "prettier-plugin-astro",
    "prettier-plugin-svelte",
    "prettier-plugin-tailwindcss",
    "prettier-plugin-organize-imports",
    "prettier-plugin-astro-organize-imports",
  ],
  overrides: [
    {
      files: "*.astro",
      options: {
        parser: "astro",
      },
    },
    {
      files: "*.svelte",
      options: {
        parser: "svelte",
      },
    },
  ],
};
