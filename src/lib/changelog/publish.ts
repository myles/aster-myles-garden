// Publishes releases to Aster's AT Protocol account: the notes as a
// standard.site document, then a Bluesky post linking to them, then the
// document again, now pointing at its post. Safe to run again: releases
// already posted are skipped, and one that stopped partway is finished.

import type { BlobRef, StrongRef } from "@/lib/atproto/xrpc";
import type { Release } from "@/lib/changelog/parse";

import {
  buildDocument,
  buildReleasePath,
  type PublishedDocument,
  type ReleaseDocument,
} from "@/lib/changelog/document";
import { buildPost, type ReleasePost } from "@/lib/changelog/post";

/** The account's repo, as publishing needs it. */
export type PublishClient = {
  listDocuments(): Promise<PublishedDocument[]>;
  createDocument(document: ReleaseDocument): Promise<StrongRef>;
  putDocument(uri: string, document: ReleaseDocument): Promise<StrongRef>;
  createPost(post: ReleasePost): Promise<StrongRef>;
};

export type ReleaseToPublish = {
  release: Release;
  /** When the release was tagged. */
  publishedAt: string;
};

export type PublishContext = {
  publicationUri: string;
  siteUrl: string;
  /** The post card's image. */
  thumb?: BlobRef;
  now: () => string;
};

export enum PublishOutcome {
  /** Already posted. */
  Skipped = "skipped",
  /** Had a document but no post, so was posted. */
  Resumed = "resumed",
  Published = "published",
}

export type PublishResult = { version: string; outcome: PublishOutcome };

/** Oldest first, so posts for several releases land in order. */
export async function publishReleases(
  client: PublishClient,
  releases: ReleaseToPublish[],
  context: PublishContext,
): Promise<PublishResult[]> {
  const documents = await client.listDocuments();
  const oldestFirst = releases.toSorted((a, b) =>
    a.publishedAt.localeCompare(b.publishedAt),
  );

  const results: PublishResult[] = [];
  for (const { release, publishedAt } of oldestFirst) {
    const path = buildReleasePath(release.version);
    const existing = documents.find(({ value }) => value.path === path);

    // One release at a time, so a failure leaves the later ones untouched.
    // oxlint-disable-next-line no-await-in-loop
    const outcome = await _publishRelease(client, context, {
      release,
      publishedAt,
      existing,
    });
    results.push({ version: release.version, outcome });
  }

  return results;
}

type ReleaseState = ReleaseToPublish & { existing?: PublishedDocument };

async function _publishRelease(
  client: PublishClient,
  context: PublishContext,
  { release, publishedAt, existing }: ReleaseState,
): Promise<PublishOutcome> {
  if (existing?.value.bskyPostRef) {
    return PublishOutcome.Skipped;
  }

  const document = buildDocument(release, publishedAt, context.publicationUri);
  const pageUrl = new URL(document.path, context.siteUrl).toString();

  // The post links to the page, which shows the document, so the document
  // goes first.
  const documentUri = existing
    ? existing.uri
    : (await client.createDocument(document)).uri;

  const post = buildPost(release, pageUrl, context.now(), context.thumb);
  const bskyPostRef = await client.createPost(post);
  await client.putDocument(documentUri, { ...document, bskyPostRef });

  return existing ? PublishOutcome.Resumed : PublishOutcome.Published;
}
