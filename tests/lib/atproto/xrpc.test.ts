import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createRecord,
  listRecords,
  resolvePdsUrl,
  toRecordKey,
  XrpcError,
} from "@/lib/atproto/xrpc";

const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;

const PDS_URL = "https://pds.example";
const SESSION = { pdsUrl: PDS_URL, did: "did:plc:aster", accessJwt: "jwt" };

function respondWith(...bodies: [number, unknown][]) {
  const fetch = vi.fn();
  for (const [status, body] of bodies) {
    fetch.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
  }
  vi.stubGlobal("fetch", fetch);

  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolvePdsUrl", () => {
  it("finds the PDS in the DID document", async () => {
    respondWith([
      HTTP_OK,
      {
        service: [{ id: "#atproto_pds", serviceEndpoint: PDS_URL }],
      },
    ]);

    await expect(resolvePdsUrl("did:plc:aster")).resolves.toBe(PDS_URL);
  });

  it("throws when the DID document has no PDS", async () => {
    respondWith([HTTP_OK, { service: [] }]);

    await expect(resolvePdsUrl("did:plc:aster")).rejects.toThrow("no PDS");
  });
});

describe("listRecords", () => {
  it("follows the cursor to the last page", async () => {
    const fetch = respondWith(
      [HTTP_OK, { records: [{ uri: "a" }], cursor: "next" }],
      [HTTP_OK, { records: [{ uri: "b" }] }],
    );

    const records = await listRecords(PDS_URL, "did:plc:aster", "collection");

    expect(records.map(({ uri }) => uri)).toEqual(["a", "b"]);
    expect(String(fetch.mock.calls[1]?.[0])).toContain("cursor=next");
  });
});

describe("createRecord", () => {
  it("sends the record with the session's token", async () => {
    const fetch = respondWith([HTTP_OK, { uri: "at://x", cid: "cid" }]);

    const ref = await createRecord(SESSION, "collection", { a: 1 });

    expect(ref).toEqual({ uri: "at://x", cid: "cid" });
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(`${PDS_URL}/xrpc/com.atproto.repo.createRecord`);
    expect(init.headers.Authorization).toBe("Bearer jwt");
    expect(JSON.parse(init.body)).toEqual({
      repo: "did:plc:aster",
      collection: "collection",
      record: { a: 1 },
    });
  });

  it("surfaces what the server said when it fails", async () => {
    respondWith([HTTP_UNAUTHORIZED, { error: "ExpiredToken" }]);

    const request = createRecord(SESSION, "collection", {});

    await expect(request).rejects.toBeInstanceOf(XrpcError);
    await expect(request).rejects.toThrow("ExpiredToken");
  });
});

describe("toRecordKey", () => {
  it("returns the URI's last part", () => {
    expect(toRecordKey("at://did/site.standard.document/3abc")).toBe("3abc");
  });
});
