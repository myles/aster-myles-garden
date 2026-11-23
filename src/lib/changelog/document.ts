// A release's notes as a standard.site document, the record AT Protocol
// readers such as Leaflet understand. The notes themselves go in the
// document's content, structured rather than as Markdown, so the site can
// render them with plain templates. https://standard.site

import { z } from "zod/mini";

import type { ListedRecord, StrongRef } from "@/lib/atproto/xrpc";
import type {
  Release,
  ReleaseItem,
  ReleaseSection,
} from "@/lib/changelog/parse";

export const DOCUMENT_COLLECTION = "site.standard.document";
export const PUBLICATION_COLLECTION = "site.standard.publication";

/** Aster's own content type, in its domain's namespace. */
export const RELEASE_NOTES_TYPE = "garden.myles.aster.releaseNotes";

const DOCUMENT_TAGS = ["aster", "release"];

export type ReleaseNotes = {
  $type: typeof RELEASE_NOTES_TYPE;
  version: string;
  releaseDate: string;
  sections: ReleaseSection[];
};

export type ReleaseDocument = {
  $type: typeof DOCUMENT_COLLECTION;
  /** The publication's AT-URI. */
  site: string;
  title: string;
  path: string;
  description: string;
  textContent: string;
  tags: string[];
  publishedAt: string;
  content: ReleaseNotes;
  /** The post announcing the release, once there is one. */
  bskyPostRef?: StrongRef;
};

/** A release document as its repo holds it. */
export type PublishedDocument = StrongRef & { value: ReleaseDocument };

const itemSchema = z.object({
  scope: z.optional(z.string()),
  text: z.string(),
  // Rendered as a link, so only web pages: never "javascript:".
  url: z.optional(z.string().check(z.startsWith("https://"))),
}) satisfies z.ZodMiniType<ReleaseItem>;

const documentSchema = z.object({
  $type: z.literal(DOCUMENT_COLLECTION),
  site: z.string(),
  title: z.string(),
  path: z.string(),
  description: z.string(),
  textContent: z.string(),
  tags: z.array(z.string()),
  publishedAt: z.string(),
  content: z.object({
    $type: z.literal(RELEASE_NOTES_TYPE),
    version: z.string(),
    releaseDate: z.string(),
    sections: z.array(
      z.object({ heading: z.string(), items: z.array(itemSchema) }),
    ),
  }),
  bskyPostRef: z.optional(z.object({ uri: z.string(), cid: z.string() })),
}) satisfies z.ZodMiniType<ReleaseDocument>;

/** Where the site shows a release. Example: "0.4.0" → "/changelog/0.4.0". */
export function buildReleasePath(version: string): string {
  return `/changelog/${version}`;
}

export function buildDocument(
  release: Release,
  publishedAt: string,
  publicationUri: string,
): ReleaseDocument {
  return {
    $type: DOCUMENT_COLLECTION,
    site: publicationUri,
    title: buildReleaseTitle(release.version),
    path: buildReleasePath(release.version),
    description: describeRelease(release),
    textContent: _buildTextContent(release),
    tags: DOCUMENT_TAGS,
    publishedAt,
    content: {
      $type: RELEASE_NOTES_TYPE,
      version: release.version,
      releaseDate: release.releaseDate,
      sections: release.sections,
    },
  };
}

/** Example: "0.4.0" → "Aster 0.4.0". */
export function buildReleaseTitle(version: string): string {
  return `Aster ${version}`;
}

/**
 * Counts each section's changes. Example:
 * "7 changes: features (5), performance (2)."
 */
export function describeRelease(release: Release): string {
  const total = release.sections.reduce(
    (sum, section) => sum + section.items.length,
    0,
  );
  const counts = release.sections
    .map(({ heading, items }) => `${heading.toLowerCase()} (${items.length})`)
    .join(", ");
  const noun = total === 1 ? "change" : "changes";

  return `${total} ${noun}: ${counts}.`;
}

/** Example: { scope: "api", text: "add transits" } → "api: add transits". */
export function formatItem(item: ReleaseItem): string {
  return item.scope ? `${item.scope}: ${item.text}` : item.text;
}

/**
 * The publication's release documents among a repo's documents. Other
 * documents in the repo, for other sites, are left out. A document for
 * this publication that isn't a release is skipped with a warning.
 */
export function selectReleaseDocuments(
  records: ListedRecord[],
  publicationUri: string,
): PublishedDocument[] {
  const documents: PublishedDocument[] = [];

  for (const { uri, cid, value } of records) {
    const isForPublication =
      typeof value === "object" &&
      value !== null &&
      "site" in value &&
      value.site === publicationUri;
    if (!isForPublication) {
      continue;
    }

    const result = documentSchema.safeParse(value);
    if (!result.success) {
      console.warn(`Skipped ${uri}: ${z.prettifyError(result.error)}`);
      continue;
    }

    documents.push({ uri, cid, value: result.data });
  }

  return documents;
}

/** Each section's heading, then its items, a line each, with no Markdown. */
function _buildTextContent(release: Release): string {
  return release.sections
    .map((section) =>
      [section.heading, ...section.items.map(formatItem)].join("\n"),
    )
    .join("\n\n");
}

const RELEASE_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeZone: "UTC",
});

/** Example: "2026-11-18" → "18 November 2026". */
export function formatReleaseDate(releaseDate: string): string {
  return RELEASE_DATE_FORMAT.format(new Date(`${releaseDate}T00:00:00Z`));
}
