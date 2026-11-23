import { describe, expect, it } from "vitest";

import type { Release } from "@/lib/changelog/parse";

import {
  buildPost,
  buildPostWebUrl,
  countGraphemes,
  MAX_POST_GRAPHEMES,
} from "@/lib/changelog/post";

import { buildBlobRef, RELEASE } from "../../fixtures/changelog";

const PAGE_URL = "https://aster.myles.garden/changelog/0.4.0";
const CREATED_AT = "2026-11-23T12:00:00.000Z";

/** A release with this many items, each this text. */
function buildRelease(itemCount: number, text: string): Release {
  return {
    ...RELEASE,
    sections: [
      {
        heading: "Features",
        items: Array.from({ length: itemCount }, () => ({ text })),
      },
    ],
  };
}

describe("buildPost", () => {
  it("lists every change when they fit", () => {
    const post = buildPost(RELEASE, PAGE_URL, CREATED_AT);

    expect(post.text).toBe(
      "Aster 0.4.0 is out.\n\n" +
        "• api: add a transits endpoint\n" +
        "• choose a light or dark wheel\n" +
        "• search the biggest cities",
    );
  });

  it("counts the changes that don't fit", () => {
    const post = buildPost(
      buildRelease(20, "a".repeat(40)),
      PAGE_URL,
      CREATED_AT,
    );

    expect(countGraphemes(post.text)).toBeLessThanOrEqual(MAX_POST_GRAPHEMES);
    expect(post.text).toMatch(/…and 14 more$/u);
  });

  it("counts emoji as one character each", () => {
    const post = buildPost(buildRelease(40, "🌙🌙🌙"), PAGE_URL, CREATED_AT);

    expect(countGraphemes(post.text)).toBeLessThanOrEqual(MAX_POST_GRAPHEMES);
    expect(post.text.length).toBeGreaterThan(MAX_POST_GRAPHEMES);
  });

  it("leaves out a change too long to fit at all", () => {
    const post = buildPost(
      buildRelease(1, "a".repeat(400)),
      PAGE_URL,
      CREATED_AT,
    );

    expect(post.text).toBe("Aster 0.4.0 is out.\n\n…and 1 more");
  });

  it("links to the release's page in a card", () => {
    const thumb = buildBlobRef("image/jpeg");

    const post = buildPost(RELEASE, PAGE_URL, CREATED_AT, thumb);

    expect(post).toMatchObject({
      $type: "app.bsky.feed.post",
      createdAt: CREATED_AT,
      embed: {
        $type: "app.bsky.embed.external",
        external: {
          uri: PAGE_URL,
          title: "Aster 0.4.0",
          description: "3 changes: features (2), performance (1).",
          thumb,
        },
      },
    });
  });

  it("refuses a post the lexicon rejects", () => {
    expect(() => buildPost(RELEASE, PAGE_URL, "yesterday")).toThrow();
  });

  it("leaves the card's image out when there's none", () => {
    const post = buildPost(RELEASE, PAGE_URL, CREATED_AT);

    expect(post.embed.external).not.toHaveProperty("thumb");
  });
});

describe("buildPostWebUrl", () => {
  it("links to the post on bsky.app", () => {
    expect(buildPostWebUrl("at://did:plc:abc/app.bsky.feed.post/3lw")).toBe(
      "https://bsky.app/profile/did:plc:abc/post/3lw",
    );
  });
});
