import type { Release } from "@/lib/changelog/parse";

/** Two releases, as release-please writes CHANGELOG.md. */
export const CHANGELOG_MARKDOWN = `# Changelog

## [0.4.0](https://github.com/myles/aster-myles-garden/compare/v0.3.0...v0.4.0) (2026-11-18)


### Features

* **api:** add a transits endpoint ([#44](https://github.com/myles/aster-myles-garden/issues/44)) ([3813354](https://github.com/myles/aster-myles-garden/commit/3813354))
* choose a \`light\` or dark wheel ([7ab94cd](https://github.com/myles/aster-myles-garden/commit/7ab94cd))


### Performance

* search the biggest cities first

## [0.3.0](https://github.com/myles/aster-myles-garden/compare/v0.2.0...v0.3.0) (2026-11-17)


### Bug fixes

* keep snake_case names ([#34](https://github.com/myles/aster-myles-garden/issues/34))
`;

export const RELEASE: Release = {
  version: "0.4.0",
  releaseDate: "2026-11-18",
  sections: [
    {
      heading: "Features",
      items: [
        {
          scope: "api",
          text: "add a transits endpoint",
          url: "https://github.com/myles/aster-myles-garden/issues/44",
        },
        { text: "choose a light or dark wheel" },
      ],
    },
    { heading: "Performance", items: [{ text: "search the biggest cities" }] },
  ],
};

export const PUBLICATION_URI =
  "at://did:plc:aster/site.standard.publication/3publication";
export const SITE_URL = "https://aster.myles.garden";
