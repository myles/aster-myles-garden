// Reads CHANGELOG.md, as release-please writes it, into releases. Only
// the sections release-please shows are in the file, so everything in it
// is kept.

export type ReleaseItem = {
  /** The conventional commit's scope, such as "api". */
  scope?: string;
  /** Plain text, with no Markdown. */
  text: string;
  /** The pull request, or the commit when there's none. */
  url?: string;
};

export type ReleaseSection = { heading: string; items: ReleaseItem[] };

export type Release = {
  version: string;
  releaseDate: string;
  sections: ReleaseSection[];
};

// Example: "## [0.4.0](https://github.com/…/v0.3.0...v0.4.0) (2026-11-18)"
const VERSION_HEADING =
  /^#{2,3} \[(?<version>\d+\.\d+\.\d+)\]\([^)]*\) \((?<date>\d{4}-\d{2}-\d{2})\)/u;
// Example: "### Features"
const SECTION_HEADING = /^### (?<heading>.+)$/u;
// Example: "* **api:** add a transits endpoint ([#44](…)) ([3813354](…))"
const ITEM =
  /^\* (?:\*\*(?<scope>[^*]+):\*\* )?(?<text>.+?)(?<links>(?: \(\[[^\]]+\]\([^)]+\)\))*)$/u;
// One of the item's trailing links: "([#44](https://…/issues/44))".
const TRAILING_LINK = /\(\[[^\]]+\]\((?<url>[^)]+)\)\)/gu;

/** Releases newest first, as the file lists them. */
export function parseChangelog(markdown: string): Release[] {
  const releases: Release[] = [];

  for (const line of markdown.split("\n")) {
    const version = VERSION_HEADING.exec(line)?.groups;
    if (version) {
      releases.push({
        version: version.version,
        releaseDate: version.date,
        sections: [],
      });
      continue;
    }

    const release = releases.at(-1);
    if (!release) {
      continue;
    }

    const section = SECTION_HEADING.exec(line)?.groups;
    if (section) {
      release.sections.push({ heading: section.heading, items: [] });
      continue;
    }

    const item = ITEM.exec(line)?.groups;
    const current = release.sections.at(-1);
    if (item && current) {
      current.items.push(_toItem(item));
    }
  }

  return releases;
}

function _toItem(groups: Record<string, string | undefined>): ReleaseItem {
  const [url] = Array.from(
    (groups.links ?? "").matchAll(TRAILING_LINK),
    (match) => match.groups?.url,
  );

  return {
    ...(groups.scope && { scope: groups.scope }),
    text: stripMarkdown(groups.text ?? ""),
    ...(url && { url }),
  };
}

/**
 * Inline Markdown as plain text. Example:
 * "add `sidereal` to [the API](https://…)" → "add sidereal to the API".
 */
export function stripMarkdown(text: string): string {
  return text
    .replaceAll(/\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replaceAll(/[*`]/gu, "");
}
