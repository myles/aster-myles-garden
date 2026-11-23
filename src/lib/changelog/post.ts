// A Bluesky post announcing a release: as many of its changes as fit in
// one post, and a card linking to the full notes on the site.

import type { BlobRef } from "@/lib/atproto/xrpc";
import type { Release } from "@/lib/changelog/parse";

import {
  buildReleaseTitle,
  describeRelease,
  formatItem,
} from "@/lib/changelog/document";

export const POST_COLLECTION = "app.bsky.feed.post";
const EXTERNAL_EMBED_TYPE = "app.bsky.embed.external";

/** Bluesky's limit, counted in what readers see as characters. */
export const MAX_POST_GRAPHEMES = 300;

const BLUESKY_WEB_URL = "https://bsky.app";
const BULLET = "• ";
const POST_LANGUAGES = ["en"];

export type ReleasePost = {
  $type: typeof POST_COLLECTION;
  text: string;
  createdAt: string;
  langs: string[];
  embed: {
    $type: typeof EXTERNAL_EMBED_TYPE;
    external: {
      uri: string;
      title: string;
      description: string;
      thumb?: BlobRef;
    };
  };
};

const graphemes = new Intl.Segmenter("en", { granularity: "grapheme" });

/**
 * `createdAt` is when it's posted, even for an old release: Bluesky
 * marks backdated posts. Example text:
 *
 *   Aster 0.4.0 is out.
 *
 *   • api: add a transits endpoint
 *   • choose a light or dark wheel when downloading
 *   …and 5 more
 */
export function buildPost(
  release: Release,
  pageUrl: string,
  createdAt: string,
  thumb?: BlobRef,
): ReleasePost {
  return {
    $type: POST_COLLECTION,
    text: _fitText(release),
    createdAt,
    langs: POST_LANGUAGES,
    embed: {
      $type: EXTERNAL_EMBED_TYPE,
      external: {
        uri: pageUrl,
        title: buildReleaseTitle(release.version),
        description: describeRelease(release),
        ...(thumb && { thumb }),
      },
    },
  };
}

/**
 * The post on the Bluesky website. Example:
 * "at://did:plc:abc/app.bsky.feed.post/3lw…" →
 * "https://bsky.app/profile/did:plc:abc/post/3lw…".
 */
export function buildPostWebUrl(uri: string): string {
  const [did, , rkey] = uri.replace("at://", "").split("/");

  return `${BLUESKY_WEB_URL}/profile/${did}/post/${rkey}`;
}

export function countGraphemes(text: string): number {
  return Array.from(graphemes.segment(text)).length;
}

/** Drops changes from the end until the rest, and a count, fit. */
function _fitText(release: Release): string {
  const heading = `${buildReleaseTitle(release.version)} is out.`;
  const lines = release.sections.flatMap((section) =>
    section.items.map((item) => `${BULLET}${formatItem(item)}`),
  );

  let shownCount = lines.length;
  let text = _composeText(heading, lines, shownCount);
  while (shownCount > 0 && countGraphemes(text) > MAX_POST_GRAPHEMES) {
    shownCount -= 1;
    text = _composeText(heading, lines, shownCount);
  }

  return text;
}

function _composeText(
  heading: string,
  lines: string[],
  shownCount: number,
): string {
  const hiddenCount = lines.length - shownCount;
  const shown = lines.slice(0, shownCount);
  const more = hiddenCount > 0 ? [`…and ${hiddenCount} more`] : [];
  const body = [...shown, ...more];

  return body.length > 0 ? `${heading}\n\n${body.join("\n")}` : heading;
}
