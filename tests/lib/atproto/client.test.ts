import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAtprotoClient } from "@/lib/atproto/client";

import { DID } from "./fixtures";

const PAGE_URL = "https://aster.example.com/app/";

const oauth = vi.hoisted(() => ({
  init: vi.fn(),
  signInRedirect: vi.fn(),
  dispose: vi.fn(),
}));
const createOAuth = vi.hoisted(() => vi.fn());
vi.mock("@atproto/oauth-client-browser", () => ({
  BrowserOAuthClient: class {
    constructor(options: unknown) {
      createOAuth(options);
    }
    init = oauth.init;
    signInRedirect = oauth.signInRedirect;
    dispose = oauth.dispose;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  oauth.init.mockResolvedValue(undefined);
  oauth.dispose.mockResolvedValue(undefined);
});

describe("createAtprotoClient", () => {
  it("restores an empty session without requesting chart data", async () => {
    const client = await createAtprotoClient(PAGE_URL);
    expect(client.did).toBeUndefined();
    expect(client.charts).toBeUndefined();
    expect(createOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        clientMetadata: expect.objectContaining({
          token_endpoint_auth_method: "none",
        }),
      }),
    );
    await client.signOut();
    await client.dispose();
    expect(oauth.dispose).toHaveBeenCalledTimes(1);
  });
  it("signs in with the handle given", async () => {
    const client = await createAtprotoClient(PAGE_URL);
    await client.signIn("you.bsky.social");
    expect(oauth.signInRedirect).toHaveBeenCalledWith("you.bsky.social");
  });
  it("refuses an insecure origin before loading the SDK", async () => {
    await expect(
      createAtprotoClient("http://example.com/app/"),
    ).rejects.toThrow("HTTPS");
    expect(createOAuth).not.toHaveBeenCalled();
  });
  it("restores and signs out any account's session", async () => {
    const session = {
      did: DID,
      signOut: vi.fn(),
      fetchHandler: vi.fn(),
    };
    oauth.init.mockResolvedValue({ session });
    const client = await createAtprotoClient(PAGE_URL);
    expect(client.did).toBe(DID);
    expect(client.charts).toBeDefined();
    expect(session.fetchHandler).not.toHaveBeenCalled();
    await client.signOut();
    expect(session.signOut).toHaveBeenCalled();
  });
  it("surfaces callback failures and disposes the SDK", async () => {
    oauth.init.mockRejectedValue(new Error("Callback rejected"));
    await expect(createAtprotoClient(PAGE_URL)).rejects.toThrow(
      "Callback rejected",
    );
    expect(oauth.dispose).toHaveBeenCalled();
  });
});
