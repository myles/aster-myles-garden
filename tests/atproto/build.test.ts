import { afterEach, describe, expect, it, vi } from "vitest";

import { getTrialPaths } from "@/experimental/atproto/build";

import { CONFIG, ENV } from "./fixtures";

afterEach(() => vi.unstubAllEnvs());

describe("trial route generation", () => {
  it("omits trial and metadata routes by default", () => {
    vi.stubEnv("ASTER_ATPROTO_TRIAL", "false");
    expect(getTrialPaths()).toEqual([]);
  });
  it("emits only the atproto trial for an explicit configuration", () => {
    for (const [key, value] of Object.entries(ENV)) {
      vi.stubEnv(key, value);
    }
    expect(getTrialPaths()).toEqual([
      { params: { trial: "atproto" }, props: { config: CONFIG } },
    ]);
  });
});
