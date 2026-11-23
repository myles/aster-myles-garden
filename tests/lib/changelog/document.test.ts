import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildDocument,
  buildReleasePath,
  describeRelease,
  formatItem,
  formatReleaseDate,
  selectReleaseDocuments,
} from "@/lib/changelog/document";

import { PUBLICATION_URI, RELEASE } from "../../fixtures/changelog";

const PUBLISHED_AT = "2026-11-18T17:00:00.000Z";
const DOCUMENT = buildDocument(RELEASE, PUBLISHED_AT, PUBLICATION_URI);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildDocument", () => {
  it("fills the standard.site fields", () => {
    expect(DOCUMENT).toMatchObject({
      $type: "site.standard.document",
      site: PUBLICATION_URI,
      title: "Aster 0.4.0",
      path: "/changelog/0.4.0",
      publishedAt: PUBLISHED_AT,
    });
  });

  it("keeps the notes as structured content", () => {
    expect(DOCUMENT.content).toEqual({
      $type: "garden.myles.aster.releaseNotes",
      version: "0.4.0",
      releaseDate: "2026-11-18",
      sections: RELEASE.sections,
    });
  });

  it("writes the text content without Markdown", () => {
    expect(DOCUMENT.textContent).toBe(
      "Features\napi: add a transits endpoint\n" +
        "choose a light or dark wheel\n\n" +
        "Performance\nsearch the biggest cities",
    );
  });
});

describe("buildReleasePath", () => {
  it("puts the release under the changelog", () => {
    expect(buildReleasePath("0.4.0")).toBe("/changelog/0.4.0");
  });
});

describe("describeRelease", () => {
  it("counts each section's changes", () => {
    expect(describeRelease(RELEASE)).toBe(
      "3 changes: features (2), performance (1).",
    );
  });

  it("says change for one", () => {
    const release = { ...RELEASE, sections: [RELEASE.sections[1]!] };

    expect(describeRelease(release)).toBe("1 change: performance (1).");
  });
});

describe("formatItem", () => {
  it("prefixes the scope", () => {
    expect(formatItem({ scope: "api", text: "add transits" })).toBe(
      "api: add transits",
    );
  });

  it("leaves an item without a scope as it is", () => {
    expect(formatItem({ text: "add transits" })).toBe("add transits");
  });
});

describe("formatReleaseDate", () => {
  it("writes the date out in full", () => {
    expect(formatReleaseDate("2026-11-18")).toBe("18 November 2026");
  });
});

describe("selectReleaseDocuments", () => {
  const record = { uri: "at://did/site.standard.document/1", cid: "cid1" };

  it("keeps the publication's release documents", () => {
    expect(
      selectReleaseDocuments([{ ...record, value: DOCUMENT }], PUBLICATION_URI),
    ).toEqual([{ ...record, value: DOCUMENT }]);
  });

  it("leaves out documents for other sites without a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const other = { ...DOCUMENT, site: "https://elsewhere.example" };

    expect(
      selectReleaseDocuments([{ ...record, value: other }], PUBLICATION_URI),
    ).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns about and skips the publication's malformed documents", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const broken = { ...DOCUMENT, content: undefined };

    expect(
      selectReleaseDocuments([{ ...record, value: broken }], PUBLICATION_URI),
    ).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(record.uri));
  });

  it("rejects links that aren't web pages", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const item = { text: "click", url: "javascript:alert(1)" };
    const sections = [{ heading: "Features", items: [item] }];
    const unsafe = { ...DOCUMENT, content: { ...DOCUMENT.content, sections } };

    expect(
      selectReleaseDocuments([{ ...record, value: unsafe }], PUBLICATION_URI),
    ).toEqual([]);
  });
});
