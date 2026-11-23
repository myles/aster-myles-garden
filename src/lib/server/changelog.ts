// Reads the release notes for the changelog pages from Aster's PDS, where
// the release workflow publishes them. Anyone can read these records, so
// no login is needed.

import { ASTER_DID, PUBLICATION_URI } from "@/consts";
import { listRecords, resolvePdsUrl } from "@/lib/atproto/xrpc";
import {
  DOCUMENT_COLLECTION,
  selectReleaseDocuments,
  type PublishedDocument,
} from "@/lib/changelog/document";

/** Short, so a new release shows up minutes after it's published. */
export const CACHE_PUBLIC_FIVE_MINUTES =
  "public, max-age=0, s-maxage=300, stale-while-revalidate=86400";

/** Every release's notes, newest first. */
export async function loadReleaseNotes(): Promise<PublishedDocument[]> {
  const pdsUrl = await resolvePdsUrl(ASTER_DID);
  const records = await listRecords(pdsUrl, ASTER_DID, DOCUMENT_COLLECTION);

  return selectReleaseDocuments(records, PUBLICATION_URI).toSorted((a, b) =>
    b.value.publishedAt.localeCompare(a.value.publishedAt),
  );
}

/** One release's notes, or undefined when it hasn't been published. */
export async function loadReleaseNote(
  version: string,
): Promise<PublishedDocument | undefined> {
  const documents = await loadReleaseNotes();

  return documents.find(({ value }) => value.content.version === version);
}
