import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTrialClient } from "@/experimental/atproto/client";

import { CONFIG, OTHER_DID } from "./fixtures";

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

describe("trial OAuth boundary", () => {
  it("restores an empty session without requesting chart data", async () => {
    const client = await createTrialClient(CONFIG);
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
  it("signs in only with the configured identity", async () => {
    const client = await createTrialClient(CONFIG);
    await client.signIn();
    expect(oauth.signInRedirect).toHaveBeenCalledWith(CONFIG.allowedDid);
  });
  it("restores and signs out the allowed session", async () => {
    const session = {
      did: CONFIG.allowedDid,
      signOut: vi.fn(),
      fetchHandler: vi.fn(),
    };
    oauth.init.mockResolvedValue({ session });
    const client = await createTrialClient(CONFIG);
    expect(client.did).toBe(CONFIG.allowedDid);
    expect(client.charts).toBeDefined();
    expect(session.fetchHandler).not.toHaveBeenCalled();
    await client.signOut();
    expect(session.signOut).toHaveBeenCalled();
  });
  it("revokes other identities without touching their records", async () => {
    const session = { did: OTHER_DID, signOut: vi.fn(), fetchHandler: vi.fn() };
    oauth.init.mockResolvedValue({ session });
    await expect(createTrialClient(CONFIG)).rejects.toThrow("restricted");
    expect(session.signOut).toHaveBeenCalled();
    expect(session.fetchHandler).not.toHaveBeenCalled();
    expect(oauth.dispose).toHaveBeenCalled();
  });
  it("surfaces callback failures and disposes the SDK", async () => {
    oauth.init.mockRejectedValue(new Error("Callback rejected"));
    await expect(createTrialClient(CONFIG)).rejects.toThrow(
      "Callback rejected",
    );
    expect(oauth.dispose).toHaveBeenCalled();
  });
});
