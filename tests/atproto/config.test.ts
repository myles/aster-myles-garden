import { describe, expect, it } from "vitest";

import {
  buildClientMetadata,
  CHART_COLLECTION,
  readTrialConfig,
} from "@/experimental/atproto/config";

import { CONFIG, ENV, OTHER_DID } from "./fixtures";

describe("readTrialConfig", () => {
  it("requires explicit opt-in", () => {
    expect(readTrialConfig({})).toBeUndefined();
    expect(
      readTrialConfig({ ...ENV, ASTER_ATPROTO_TRIAL: "false" }),
    ).toBeUndefined();
  });
  it("accepts the owner's existing Space", () => {
    expect(readTrialConfig(ENV)).toEqual(CONFIG);
  });
  it("derives the personal Space when no URI is supplied", () => {
    expect(readTrialConfig({ ...ENV, ASTER_ATPROTO_SPACE: undefined })).toEqual(
      CONFIG,
    );
  });
  it.each([
    { ASTER_ATPROTO_DID: "" },
    { ASTER_ATPROTO_SPACE: CONFIG.space.replace(CONFIG.allowedDid, OTHER_DID) },
    { ASTER_ATPROTO_SPACE: "at://bad" },
    { ASTER_ATPROTO_SPACE: CONFIG.space.replace(CONFIG.spaceType, "bad") },
    { ASTER_ATPROTO_ORIGIN: "http://example.com" },
    { ASTER_ATPROTO_ORIGIN: "https://example.com/path" },
    { ASTER_ATPROTO_ORIGIN: "https://user@example.com" },
    { ASTER_ATPROTO_ORIGIN: "https://example.com?test=true" },
  ])("rejects malformed or unsafe settings: %j", (changes) => {
    expect(() => readTrialConfig({ ...ENV, ...changes })).toThrow();
  });
});

describe("buildClientMetadata", () => {
  it("uses a loopback client with narrowly scoped Space access", () => {
    const metadata = buildClientMetadata(CONFIG);
    const clientId = new URL(metadata.client_id);
    expect(clientId.origin).toBe("http://localhost");
    expect(clientId.searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:4321/trials/atproto/",
    );
    expect(clientId.searchParams.get("scope")).toBe(metadata.scope);
    expect(metadata.scope).toContain(`collection=${CHART_COLLECTION}`);
    expect(metadata.scope).toContain("authority=self");
    expect(metadata.scope).toContain("action=read_self");
    expect(metadata.scope).not.toContain("repo:");
    expect(metadata.scope).toContain("manage=create");
    expect(metadata.application_type).toBe("native");
  });
  it("publishes HTTPS metadata and a fixed callback", () => {
    const metadata = buildClientMetadata({
      ...CONFIG,
      origin: "https://trial.example.com",
    });
    expect(metadata.client_id).toBe(
      "https://trial.example.com/trials/atproto/client-metadata.json",
    );
    expect(metadata.redirect_uris).toEqual([
      "https://trial.example.com/trials/atproto/",
    ]);
    expect(metadata.application_type).toBe("web");
    expect(metadata.token_endpoint_auth_method).toBe("none");
    expect(metadata.dpop_bound_access_tokens).toBe(true);
  });
});
