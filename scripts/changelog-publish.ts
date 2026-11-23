// Publishes each release in CHANGELOG.md that isn't on Aster's AT Protocol
// account yet: its notes as a standard.site document, and a Bluesky post
// linking to them. Releases already posted are skipped, so it's safe to
// run again. The release workflow runs it after each release.
//
// Usage:
//   BLUESKY_APP_PASSWORD=… npm run changelog:publish
//
// The app password is @aster.myles.garden's, from Bluesky's settings.
// Keep it in .env, which is gitignored, or a GitHub secret: never commit it.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { ASTER_DID, ASTER_HANDLE, PUBLICATION_URI, SITE_URL } from "@/consts";
import {
  createRecord,
  createSession,
  listRecords,
  putRecord,
  resolvePdsUrl,
  toRecordKey,
  uploadBlob,
  type Session,
} from "@/lib/atproto/xrpc";
import {
  DOCUMENT_COLLECTION,
  selectReleaseDocuments,
} from "@/lib/changelog/document";
import { parseChangelog } from "@/lib/changelog/parse";
import { POST_COLLECTION } from "@/lib/changelog/post";
import { publishReleases, type PublishClient } from "@/lib/changelog/publish";

const APP_PASSWORD_ENV_VAR = "BLUESKY_APP_PASSWORD";
const CHANGELOG_PATH = "CHANGELOG.md";
const THUMB_PATH = "public/og-image.jpg";
const THUMB_MIME_TYPE = "image/jpeg";

const password = process.env[APP_PASSWORD_ENV_VAR];
if (!password) {
  throw new Error(`Set ${APP_PASSWORD_ENV_VAR} to the account's app password.`);
}

const releases = parseChangelog(readFileSync(CHANGELOG_PATH, "utf8")).map(
  (release) => ({ release, publishedAt: readTagTime(release.version) }),
);

const pdsUrl = await resolvePdsUrl(ASTER_DID);
const session = await createSession(pdsUrl, ASTER_HANDLE, password);
const thumb = await uploadBlob(
  session,
  new Uint8Array(readFileSync(THUMB_PATH)),
  THUMB_MIME_TYPE,
);

const results = await publishReleases(createClient(session), releases, {
  publicationUri: PUBLICATION_URI,
  siteUrl: SITE_URL,
  thumb,
  now: () => new Date().toISOString(),
});

for (const { version, outcome } of results) {
  console.log(`${version}: ${outcome}`);
}

/** When release-please tagged the version, from the tag's commit. */
function readTagTime(version: string): string {
  const committedAt = execFileSync(
    "git",
    ["log", "-1", "--format=%cI", `v${version}`],
    { encoding: "utf8" },
  ).trim();

  return new Date(committedAt).toISOString();
}

function createClient(activeSession: Session): PublishClient {
  return {
    listDocuments: async () =>
      selectReleaseDocuments(
        await listRecords(
          activeSession.pdsUrl,
          activeSession.did,
          DOCUMENT_COLLECTION,
        ),
        PUBLICATION_URI,
      ),
    createDocument: (document) =>
      createRecord(activeSession, DOCUMENT_COLLECTION, document),
    putDocument: (uri, document) =>
      putRecord(activeSession, DOCUMENT_COLLECTION, toRecordKey(uri), document),
    createPost: (post) => createRecord(activeSession, POST_COLLECTION, post),
  };
}
