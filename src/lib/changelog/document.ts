// A release's notes as a standard.site document, the record AT Protocol
// readers such as Leaflet understand. The notes themselves go in the
// document's content, structured rather than as Markdown, so the site can
// render them with plain templates. https://standard.site

import type { Release, ReleaseItem } from "@/lib/changelog/parse";

import * as releaseNotes from "@/lexicons/garden/myles/aster/releaseNotes";
import * as siteDocument from "@/lexicons/site/standard/document";

const DOCUMENT_COLLECTION = siteDocument.$nsid;

/** Aster's own content type, in its domain's namespace. */
const RELEASE_NOTES_TYPE = releaseNotes.$type;

const DOCUMENT_TAGS = ["aster", "release"];

export type ReleaseNotes = releaseNotes.Main & {
  $type: typeof RELEASE_NOTES_TYPE;
};

/**
 * A standard.site document with the fields a release always fills. Its
 * content is Aster's own type, where the lexicon allows any.
 */
export type ReleaseDocument = Omit<siteDocument.Main, "content"> &
  Required<
    Pick<siteDocument.Main, "path" | "description" | "textContent" | "tags">
  > & { content: ReleaseNotes };

/** A record as a repo lists it, not yet checked against any lexicon. */
export type ListedRecord = { uri: string; cid: string; value: unknown };

/** A release document as its repo holds it. */
export type PublishedDocument = Omit<ListedRecord, "value"> & {
  value: ReleaseDocument;
};

/** Where the site shows a release. Example: "0.4.0" → "/changelog/0.4.0". */
export function buildReleasePath(version: string): string {
  return `/changelog/${version}`;
}

/** Checked against both lexicons, so a malformed release never leaves. */
export function buildDocument(
  release: Release,
  publishedAt: string,
  publicationUri: string,
): ReleaseDocument {
  const document = _parseReleaseDocument({
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
  });
  if (typeof document === "string") {
    throw new Error(`Release ${release.version} is malformed: ${document}`);
  }

  return document;
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

    const document = _parseReleaseDocument(value);
    if (typeof document === "string") {
      console.warn(`Skipped ${uri}: ${document}`);
      continue;
    }

    documents.push({ uri, cid, value: document });
  }

  return documents;
}

/**
 * A release document, or why the value isn't one. The lexicons allow any
 * URI scheme, but items are rendered as links, so only web pages are
 * kept: never "javascript:".
 */
function _parseReleaseDocument(value: unknown): ReleaseDocument | string {
  const document = siteDocument.$safeParse(value);
  if (!document.success) {
    return document.reason.message;
  }

  const { path, description, textContent, tags } = document.value;
  if (
    path === undefined ||
    description === undefined ||
    textContent === undefined ||
    tags === undefined
  ) {
    return "it is missing a path, description, text content or tags";
  }

  const content = releaseNotes.$safeParse(document.value.content);
  if (!content.success) {
    return content.reason.message;
  }
  const { $type, ...notes } = content.value;
  if ($type !== RELEASE_NOTES_TYPE) {
    return `its content isn't ${RELEASE_NOTES_TYPE}`;
  }

  const urls = notes.sections.flatMap(({ items }) =>
    items.flatMap(({ url }) => (url === undefined ? [] : [url])),
  );
  if (!urls.every((url) => url.startsWith("https://"))) {
    return "an item links somewhere other than a web page";
  }

  return {
    ...document.value,
    path,
    description,
    textContent,
    tags,
    content: { $type, ...notes },
  };
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
