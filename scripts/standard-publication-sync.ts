// Writes Aster's standard.site publication from the site's name,
// description and icon, so changing those and running this updates it.
// It replaces the record at PUBLICATION_URI, or recreates it there if
// it's gone.
//
// Usage:
//   BLUESKY_APP_PASSWORD=… npm run standard:publication-sync

import { readFileSync } from "node:fs";

import {
  ASTER_DID,
  ASTER_HANDLE,
  PUBLICATION_URI,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
} from "@/consts";
import {
  createSession,
  putRecord,
  resolvePdsUrl,
  toRecordKey,
  uploadBlob,
} from "@/lib/atproto/xrpc";
import { PUBLICATION_COLLECTION } from "@/lib/changelog/document";
import { buildPublication } from "@/lib/changelog/publication";

const APP_PASSWORD_ENV_VAR = "BLUESKY_APP_PASSWORD";

/** Square, and at least 256 pixels, as the lexicon asks. */
const ICON_PATH = "public/icon-512.png";
const ICON_MIME_TYPE = "image/png";

const password = process.env[APP_PASSWORD_ENV_VAR];
if (!password) {
  throw new Error(`Set ${APP_PASSWORD_ENV_VAR} to the account's app password.`);
}

const pdsUrl = await resolvePdsUrl(ASTER_DID);
const session = await createSession(pdsUrl, ASTER_HANDLE, password);

// Uploading the same icon again stores nothing new: blobs are keyed by
// their contents.
const icon = await uploadBlob(
  session,
  new Uint8Array(readFileSync(ICON_PATH)),
  ICON_MIME_TYPE,
);

const publication = buildPublication({
  url: SITE_URL,
  name: SITE_TITLE,
  description: SITE_DESCRIPTION,
  icon,
});

const { uri } = await putRecord(
  session,
  PUBLICATION_COLLECTION,
  toRecordKey(PUBLICATION_URI),
  publication,
);

console.log(`Wrote ${uri}`);
