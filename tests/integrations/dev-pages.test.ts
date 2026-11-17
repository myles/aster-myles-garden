import { describe, expect, it, vi } from "vitest";

import { DEV_PAGES, devPages } from "@/integrations/dev-pages";

/** Runs the integration's setup hook as Astro would for `command`. */
function setUp(command: "dev" | "build" | "preview") {
  const injectRoute = vi.fn();
  const hook = devPages().hooks["astro:config:setup"] as (
    options: unknown,
  ) => void;
  hook({ command, injectRoute });
  return injectRoute;
}

describe("devPages", () => {
  it("serves the dev pages under npm run dev", () => {
    const injectRoute = setUp("dev");

    expect(injectRoute).toHaveBeenCalledTimes(DEV_PAGES.length);
    expect(injectRoute).toHaveBeenCalledWith(
      expect.objectContaining({ pattern: "/dev/components" }),
    );
  });

  it.each(["build", "preview"] as const)("leaves them out of %s", (command) => {
    expect(setUp(command)).not.toHaveBeenCalled();
  });
});
