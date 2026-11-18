// The dark theme is written twice in global.css: for the page in dark
// mode, and for a wheel downloaded dark. CSS can't share one block
// between a media query and a class, so this keeps the copies in step.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = readFileSync("src/styles/global.css", "utf8");

/** The declarations in the first block opened by `opening`, normalised. */
function readDeclarations(opening: string): string[] {
  const start = CSS.indexOf(opening);
  if (start === -1) {
    throw new Error(`global.css has no "${opening}" block.`);
  }

  const bodyStart = CSS.indexOf("{", start + opening.length - 1) + 1;
  const body = CSS.slice(bodyStart, CSS.indexOf("}", bodyStart));

  return body
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .split(";")
    .map((declaration) =>
      declaration
        .replaceAll(/\s+/g, " ")
        .replaceAll(/\( | \)/g, (match) => match.trim())
        .trim(),
    )
    .filter((declaration) => declaration.length > 0);
}

function readNames(declarations: string[]): string[] {
  return declarations
    .map((declaration) => declaration.split(":")[0])
    .toSorted();
}

describe("global.css themes", () => {
  const pageDark = readDeclarations(
    "@media (prefers-color-scheme: dark) {\n  :root {",
  );
  const wheelDark = readDeclarations(".wheel-theme-dark {");
  const light = readDeclarations(":root,\n.wheel-theme-light {");

  it("gives a wheel downloaded dark the page's dark theme", () => {
    expect(pageDark.length).toBeGreaterThan(0);
    expect(wheelDark).toEqual(pageDark);
  });

  it("sets every light token in the dark theme too", () => {
    expect(readNames(pageDark)).toEqual(readNames(light));
  });
});
