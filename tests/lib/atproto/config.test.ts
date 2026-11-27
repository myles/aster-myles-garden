import { describe, expect, it } from "vitest";

import {
  buildClientMetadata,
  buildSpaceUri,
  CHART_COLLECTION,
  parseAppOrigin,
} from "@/lib/atproto/config";

import { DID } from "./fixtures";

describe("buildSpaceUri", () => {
  it("names the account's personal Aster Space", () => {
    expect(buildSpaceUri(DID)).toBe(
      `at:space/${DID}/garden.myles.aster.space/self`,
    );
  });
});

describe("parseAppOrigin", () => {
  it.each([
    ["https://aster.myles.garden/app/?code=1", "https://aster.myles.garden"],
    ["http://127.0.0.1:4321/app/", "http://127.0.0.1:4321"],
  ])("accepts %s", (pageUrl, origin) => {
    expect(parseAppOrigin(pageUrl)).toBe(origin);
  });
  it.each([
    "http://localhost:4321/app/",
    "http://example.com/app/",
    "not a url",
  ])("rejects %s", (pageUrl) => {
    expect(() => parseAppOrigin(pageUrl)).toThrow();
  });
});

describe("buildClientMetadata", () => {
  it("uses a loopback client with narrowly scoped Space access", () => {
    const metadata = buildClientMetadata("http://127.0.0.1:4321");
    const clientId = new URL(metadata.client_id);
    expect(clientId.origin).toBe("http://localhost");
    expect(clientId.searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:4321/app/",
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
    const metadata = buildClientMetadata("https://aster.example.com");
    expect(metadata.client_id).toBe(
      "https://aster.example.com/app/client-metadata.json",
    );
    expect(metadata.redirect_uris).toEqual(["https://aster.example.com/app/"]);
    expect(metadata.client_uri).toBe("https://aster.example.com/");
    expect(metadata.application_type).toBe("web");
    expect(metadata.token_endpoint_auth_method).toBe("none");
    expect(metadata.dpop_bound_access_tokens).toBe(true);
  });
});
