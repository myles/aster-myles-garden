// Creates Aster's standard.site publication, the record its release notes
// belong to. Run it once, then put the AT-URI it prints in PUBLICATION_URI
// in src/consts.ts and in public/.well-known/site.standard.publication.
//
// Usage:
//   BLUESKY_APP_PASSWORD=… npm run standard:publication-create

import { readFileSync } from "node:fs";

import {
  ASTER_DID,
  ASTER_HANDLE,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
} from "@/consts";
import {
  createRecord,
  createSession,
  resolvePdsUrl,
  uploadBlob,
} from "@/lib/atproto/xrpc";
import { PUBLICATION_COLLECTION } from "@/lib/changelog/document";

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
const icon = await uploadBlob(
  session,
  new Uint8Array(readFileSync(ICON_PATH)),
  ICON_MIME_TYPE,
);

const { uri } = await createRecord(session, PUBLICATION_COLLECTION, {
  $type: PUBLICATION_COLLECTION,
  url: SITE_URL,
  name: SITE_TITLE,
  description: SITE_DESCRIPTION,
  icon,
});

console.log(uri);
