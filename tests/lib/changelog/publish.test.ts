import { describe, expect, it, vi } from "vitest";

import type * as strongRef from "@/lexicons/com/atproto/repo/strongRef";
import type { ReleasePost } from "@/lib/changelog/post";

import {
  buildDocument,
  type PublishedDocument,
} from "@/lib/changelog/document";
import {
  publishReleases,
  PublishOutcome,
  type PublishClient,
} from "@/lib/changelog/publish";

import { PUBLICATION_URI, RELEASE, SITE_URL } from "../../fixtures/changelog";

const OLDER = { ...RELEASE, version: "0.3.0" };
const NEWER = RELEASE;
const OLDER_PUBLISHED_AT = "2026-11-17T12:00:00.000Z";
const NEWER_PUBLISHED_AT = "2026-11-18T12:00:00.000Z";

const DOCUMENT_REF: strongRef.Main = {
  uri: "at://did/site.standard.document/3doc",
  cid: "doc-cid",
};
const POST_REF: strongRef.Main = {
  uri: "at://did/app.bsky.feed.post/3post",
  cid: "post-cid",
};

const CONTEXT = {
  publicationUri: PUBLICATION_URI,
  siteUrl: SITE_URL,
  now: () => "2026-11-23T12:00:00.000Z",
};

function createFakeClient(documents: PublishedDocument[] = []) {
  return {
    listDocuments: vi.fn(async () => documents),
    createDocument: vi.fn(async () => DOCUMENT_REF),
    putDocument: vi.fn(async () => DOCUMENT_REF),
    createPost: vi.fn(async (_post: ReleasePost) => POST_REF),
  } satisfies PublishClient;
}

describe("publishReleases", () => {
  it("creates the document, posts, then links the post", async () => {
    const client = createFakeClient();

    const results = await publishReleases(
      client,
      [{ release: NEWER, publishedAt: NEWER_PUBLISHED_AT }],
      CONTEXT,
    );

    const document = buildDocument(NEWER, NEWER_PUBLISHED_AT, PUBLICATION_URI);
    expect(client.createDocument).toHaveBeenCalledWith(document);
    expect(client.createPost).toHaveBeenCalledWith(
      expect.objectContaining({
        embed: expect.objectContaining({
          external: expect.objectContaining({
            uri: "https://aster.myles.garden/changelog/0.4.0",
          }),
        }),
      }),
    );
    expect(client.putDocument).toHaveBeenCalledWith(DOCUMENT_REF.uri, {
      ...document,
      bskyPostRef: POST_REF,
    });
    expect(results).toEqual([
      { version: "0.4.0", outcome: PublishOutcome.Published },
    ]);
  });

  it("skips a release that's already posted", async () => {
    const document = buildDocument(NEWER, NEWER_PUBLISHED_AT, PUBLICATION_URI);
    const client = createFakeClient([
      { ...DOCUMENT_REF, value: { ...document, bskyPostRef: POST_REF } },
    ]);

    const results = await publishReleases(
      client,
      [{ release: NEWER, publishedAt: NEWER_PUBLISHED_AT }],
      CONTEXT,
    );

    expect(client.createDocument).not.toHaveBeenCalled();
    expect(client.createPost).not.toHaveBeenCalled();
    expect(client.putDocument).not.toHaveBeenCalled();
    expect(results).toEqual([
      { version: "0.4.0", outcome: PublishOutcome.Skipped },
    ]);
  });

  it("finishes a release whose document has no post", async () => {
    const document = buildDocument(NEWER, NEWER_PUBLISHED_AT, PUBLICATION_URI);
    const client = createFakeClient([{ ...DOCUMENT_REF, value: document }]);

    const results = await publishReleases(
      client,
      [{ release: NEWER, publishedAt: NEWER_PUBLISHED_AT }],
      CONTEXT,
    );

    expect(client.createDocument).not.toHaveBeenCalled();
    expect(client.createPost).toHaveBeenCalledOnce();
    expect(client.putDocument).toHaveBeenCalledWith(DOCUMENT_REF.uri, {
      ...document,
      bskyPostRef: POST_REF,
    });
    expect(results).toEqual([
      { version: "0.4.0", outcome: PublishOutcome.Resumed },
    ]);
  });

  it("posts the oldest release first", async () => {
    const client = createFakeClient();

    const results = await publishReleases(
      client,
      [
        { release: NEWER, publishedAt: NEWER_PUBLISHED_AT },
        { release: OLDER, publishedAt: OLDER_PUBLISHED_AT },
      ],
      CONTEXT,
    );

    expect(results.map(({ version }) => version)).toEqual(["0.3.0", "0.4.0"]);
    expect(client.createPost.mock.calls[0]?.[0].text).toMatch(
      /^Aster 0\.3\.0/u,
    );
  });

  it("stops at a release that fails, leaving later ones", async () => {
    const client = createFakeClient();
    client.createPost.mockRejectedValueOnce(new Error("rate limited"));

    await expect(
      publishReleases(
        client,
        [
          { release: OLDER, publishedAt: OLDER_PUBLISHED_AT },
          { release: NEWER, publishedAt: NEWER_PUBLISHED_AT },
        ],
        CONTEXT,
      ),
    ).rejects.toThrow("rate limited");
    expect(client.createDocument).toHaveBeenCalledOnce();
  });
});
