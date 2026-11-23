import { afterEach, describe, expect, it, vi } from "vitest";

import { PUBLICATION_URI } from "@/consts";
import { buildDocument } from "@/lib/changelog/document";
import { loadReleaseNote, loadReleaseNotes } from "@/lib/server/changelog";

import { RELEASE } from "../../fixtures/changelog";

const HTTP_OK = 200;

const OLDER = buildDocument(
  { ...RELEASE, version: "0.3.0" },
  "2026-11-17T12:00:00.000Z",
  PUBLICATION_URI,
);
const NEWER = buildDocument(
  RELEASE,
  "2026-11-18T12:00:00.000Z",
  PUBLICATION_URI,
);
const ELSEWHERE = { ...NEWER, site: "https://elsewhere.example" };

/** The DID document, then one page of the repo's documents. */
function serveDocuments(values: unknown[]) {
  const didDocument = {
    service: [{ id: "#atproto_pds", serviceEndpoint: "https://pds.example" }],
  };
  const records = values.map((value, index) => ({
    uri: `at://did/site.standard.document/${index}`,
    cid: `cid${index}`,
    value,
  }));

  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(didDocument), { status: HTTP_OK }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ records }), { status: HTTP_OK }),
      ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadReleaseNotes", () => {
  it("returns the publication's releases, newest first", async () => {
    serveDocuments([OLDER, ELSEWHERE, NEWER]);

    const documents = await loadReleaseNotes();

    expect(documents.map(({ value }) => value.content.version)).toEqual([
      "0.4.0",
      "0.3.0",
    ]);
  });
});

describe("loadReleaseNote", () => {
  it("finds one release by version", async () => {
    serveDocuments([OLDER, NEWER]);

    const document = await loadReleaseNote("0.3.0");

    expect(document?.value.title).toBe("Aster 0.3.0");
  });

  it("returns undefined for a release that isn't published", async () => {
    serveDocuments([OLDER]);

    await expect(loadReleaseNote("9.9.9")).resolves.toBeUndefined();
  });
});
