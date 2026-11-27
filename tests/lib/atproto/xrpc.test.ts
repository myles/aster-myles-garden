import { afterEach, describe, expect, it, vi } from "vitest";

import * as siteDocument from "@/lexicons/site/standard/document";
import {
  createPublicClient,
  loginWithAppPassword,
  resolvePdsUrl,
} from "@/lib/atproto/xrpc";

const HTTP_NOT_FOUND = 404;

const DID = "did:plc:aster";
const PDS_URL = "https://pds.example";
const DID_DOCUMENT = {
  service: [{ id: "#atproto_pds", serviceEndpoint: PDS_URL }],
};

/** Fake tokens: the PDS's reply to an app password login. */
const SESSION = {
  did: DID,
  handle: "aster.myles.garden",
  accessJwt: "fake-access-jwt",
  refreshJwt: "fake-refresh-jwt",
};

function respondWith(...responses: Response[]) {
  const fetch = vi.fn();
  for (const response of responses) {
    fetch.mockResolvedValueOnce(response);
  }
  vi.stubGlobal("fetch", fetch);

  return fetch;
}

/** The URL and body of a fetch call, whichever form the caller used. */
async function readRequest(call: unknown[]) {
  const request = new Request(call[0] as RequestInfo, call[1] as RequestInit);
  const body = request.method === "GET" ? undefined : await request.text();

  return { url: new URL(request.url), method: request.method, body };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolvePdsUrl", () => {
  it("finds the PDS in the DID document", async () => {
    respondWith(Response.json(DID_DOCUMENT));

    await expect(resolvePdsUrl(DID)).resolves.toBe(PDS_URL);
  });

  it("throws when the DID document has no PDS", async () => {
    respondWith(Response.json({ service: [] }));

    await expect(resolvePdsUrl(DID)).rejects.toThrow("no PDS");
  });

  it("throws when the directory can't resolve the DID", async () => {
    respondWith(new Response("Not found", { status: HTTP_NOT_FOUND }));

    await expect(resolvePdsUrl(DID)).rejects.toThrow(String(HTTP_NOT_FOUND));
  });
});

describe("createPublicClient", () => {
  it("reads records from the account's PDS", async () => {
    const fetch = respondWith(
      Response.json(DID_DOCUMENT),
      Response.json({ records: [] }),
    );

    const client = await createPublicClient(DID);
    await client.list(siteDocument, { repo: DID });

    const { url } = await readRequest(fetch.mock.calls[1]);
    expect(url.origin).toBe(PDS_URL);
    expect(url.pathname).toBe("/xrpc/com.atproto.repo.listRecords");
    expect(url.searchParams.get("repo")).toBe(DID);
  });
});

describe("loginWithAppPassword", () => {
  it("logs in at the account's PDS", async () => {
    const fetch = respondWith(
      Response.json(DID_DOCUMENT),
      Response.json(SESSION),
    );

    const client = await loginWithAppPassword(
      DID,
      SESSION.handle,
      "fake-app-password",
    );

    const { url, method, body } = await readRequest(fetch.mock.calls[1]);
    expect(url.href).toBe(`${PDS_URL}/xrpc/com.atproto.server.createSession`);
    expect(method).toBe("POST");
    expect(JSON.parse(body ?? "")).toMatchObject({
      identifier: SESSION.handle,
      password: "fake-app-password",
    });
    expect(client.did).toBe(DID);
  });
});
