import { describe, expect, it } from "vitest";

import { buildPublication } from "@/lib/changelog/publication";

import { buildBlobRef } from "../../fixtures/changelog";

const ICON = buildBlobRef("image/png");

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

  it("refuses a publication the lexicon rejects", () => {
    expect(() => buildPublication({ ...FIELDS, url: "not a url" })).toThrow();
  });
});
