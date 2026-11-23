export const SITE_URL = "https://aster.myles.garden";
export const SITE_TITLE: string = "Aster";
export const SITE_DESCRIPTION: string =
  "A natal chart, calculated in your browser.";
export const SOURCE_URL = "https://github.com/myles/aster-myles-garden";
export const AUTHOR_URL = "https://myles.garden";

// Aster's entry in Myles' registry of projects.
export const REGISTRY_URL = "https://registry.myles.garden/";
export const REGISTRY_IDENTIFIER = "MB-360";
export const REGISTRY_ENTRY_URL = `${REGISTRY_URL}${REGISTRY_IDENTIFIER}`;

// A named import, so only the version reaches the browser's bundle, not
// the rest of package.json. release-please bumps it in each release PR.
export { version as VERSION } from "../package.json";
