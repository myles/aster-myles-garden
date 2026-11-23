import { describe, expect, it } from "vitest";

import { parseChangelog, stripMarkdown } from "@/lib/changelog/parse";

import { CHANGELOG_MARKDOWN } from "../../fixtures/changelog";

describe("parseChangelog", () => {
  const releases = parseChangelog(CHANGELOG_MARKDOWN);

  it("reads each release, newest first", () => {
    expect(
      releases.map(({ version, releaseDate }) => [version, releaseDate]),
    ).toEqual([
      ["0.4.0", "2026-11-18"],
      ["0.3.0", "2026-11-17"],
    ]);
  });

  it("groups items under their section", () => {
    expect(
      releases[0]?.sections.map(({ heading, items }) => [
        heading,
        items.length,
      ]),
    ).toEqual([
      ["Features", 2],
      ["Performance", 1],
    ]);
  });

  it("splits off the scope and links to the pull request", () => {
    expect(releases[0]?.sections[0]?.items[0]).toEqual({
      scope: "api",
      text: "add a transits endpoint",
      url: "https://github.com/myles/aster-myles-garden/issues/44",
    });
  });

  it("links to the commit when there's no pull request", () => {
    expect(releases[0]?.sections[0]?.items[1]).toEqual({
      text: "choose a light or dark wheel",
      url: "https://github.com/myles/aster-myles-garden/commit/7ab94cd",
    });
  });

  it("keeps an item with no links", () => {
    expect(releases[0]?.sections[1]?.items[0]).toEqual({
      text: "search the biggest cities first",
    });
  });

  it("reads nothing from a changelog with no releases", () => {
    expect(parseChangelog("# Changelog\n")).toEqual([]);
  });
});

describe("stripMarkdown", () => {
  it("keeps link text and drops emphasis and code", () => {
    expect(
      stripMarkdown("add `sidereal` to **[the API](https://example.com)**"),
    ).toBe("add sidereal to the API");
  });

  it("keeps underscores, which are often in names", () => {
    expect(stripMarkdown("keep snake_case names")).toBe(
      "keep snake_case names",
    );
  });
});
