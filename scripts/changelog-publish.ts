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

import type { Client } from "@atproto/lex-client";

import { AtUri } from "@atproto/syntax";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { ASTER_DID, ASTER_HANDLE, PUBLICATION_URI, SITE_URL } from "@/consts";
import * as appPost from "@/lexicons/app/bsky/feed/post";
import * as siteDocument from "@/lexicons/site/standard/document";
import { loginWithAppPassword } from "@/lib/atproto/xrpc";
import { selectReleaseDocuments } from "@/lib/changelog/document";
import { parseChangelog } from "@/lib/changelog/parse";
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

const client = await loginWithAppPassword(ASTER_DID, ASTER_HANDLE, password);
const { blob: thumb } = (
  await client.uploadBlob(new Uint8Array(readFileSync(THUMB_PATH)), {
    encoding: THUMB_MIME_TYPE,
  })
).body;

const results = await publishReleases(createPublishClient(client), releases, {
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

// Documents are written as plain records: their content is Aster's own
// type, which the typed helpers can't accept for standard.site's open
// union. buildDocument has already checked them against both lexicons.
function createPublishClient(activeClient: Client): PublishClient {
  return {
    listDocuments: async () =>
      selectReleaseDocuments(
        await Array.fromAsync(activeClient.listAll(siteDocument)),
        PUBLICATION_URI,
      ),
    createDocument: async (document) =>
      (await activeClient.createRecord(document)).body,
    putDocument: async (uri, document) =>
      (await activeClient.putRecord(document, new AtUri(uri).rkey)).body,
    createPost: (post) => activeClient.create(appPost, post),
  };
}
