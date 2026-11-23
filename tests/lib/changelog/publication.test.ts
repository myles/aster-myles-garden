import { describe, expect, it } from "vitest";

import type { BlobRef } from "@/lib/atproto/xrpc";

import { buildPublication } from "@/lib/changelog/publication";

const ICON: BlobRef = {
  $type: "blob",
  ref: { $link: "bafk" },
  mimeType: "image/png",
  size: 1,
};

const FIELDS = {
  url: "https://aster.myles.garden",
  name: "Aster",
  description: "A natal chart, calculated in your browser.",
  icon: ICON,
};

describe("buildPublication", () => {
  it("fills the standard.site fields", () => {
    expect(buildPublication(FIELDS)).toEqual({
      $type: "site.standard.publication",
      ...FIELDS,
    });
  });

  it("drops a trailing slash from the URL, as the lexicon asks", () => {
    const publication = buildPublication({
      ...FIELDS,
      url: "https://aster.myles.garden/",
    });

    expect(publication.url).toBe("https://aster.myles.garden");
  });
});
