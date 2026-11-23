import { describe, expect, it } from "vitest";

import { VERSION } from "@/consts";

import packageJson from "../../package.json";

describe("VERSION", () => {
  it("is the version in package.json", () => {
    expect(VERSION).toBe(packageJson.version);
  });
});
