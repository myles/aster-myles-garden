import { describe, expect, it } from "vitest";

import { VERSION } from "@/consts";
import { buildReleaseUrl } from "@/lib/release";

import packageJson from "../../package.json";

describe("VERSION", () => {
  it("is the version in package.json", () => {
    expect(VERSION).toBe(packageJson.version);
  });
});

describe("buildReleaseUrl", () => {
  it("links to the version's tagged release", () => {
    expect(buildReleaseUrl("0.2.0")).toBe(
      "https://github.com/myles/aster-myles-garden/releases/tag/v0.2.0",
    );
  });
});
