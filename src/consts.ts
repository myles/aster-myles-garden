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

// Aster's AT Protocol account, which announces each release on Bluesky
// and keeps its notes as documents in a standard.site publication.
export const ASTER_HANDLE = "aster.myles.garden";
export const ASTER_DID = "did:plc:vzffyjm4owshm3ngn5sfh577";
// Written by scripts/standard-publication-sync.ts. Also served at
// public/.well-known/site.standard.publication, which must match.
const PUBLICATION_RKEY = "3n2ytgiq6vb2a";
export const PUBLICATION_URI = `at://${ASTER_DID}/site.standard.publication/${PUBLICATION_RKEY}`;

// A named import, so only the version reaches the browser's bundle, not
// the rest of package.json. release-please bumps it in each release PR.
export { version as VERSION } from "../package.json";
