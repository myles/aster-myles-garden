import { afterEach, describe, expect, it, vi } from "vitest";

import { ASTER_DID, PUBLICATION_URI } from "@/consts";
import { buildDocument } from "@/lib/changelog/document";
import { loadReleaseNote, loadReleaseNotes } from "@/lib/server/changelog";

import { RELEASE } from "../../fixtures/changelog";

/** Any well-formed record CID: listing checks the format, not the hash. */
const RECORD_CID =
  "bafyreiansycpa3ggyxqnttzb7ir3dw654s2vk7nldpss6jz65m5zh5frzu";

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
    uri: `at://${ASTER_DID}/site.standard.document/${index}`,
    cid: RECORD_CID,
    value,
  }));

  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json(didDocument))
      .mockResolvedValueOnce(Response.json({ records })),
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
