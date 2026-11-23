import { describe, expect, it } from "vitest";

import {
  GUIDE_SECTIONS,
  GuideTopic,
  toGuideAnchor,
} from "@/components/guide/topics";

// Every topic's Markdown, keyed by its id: "settings/house-system".
const GUIDE_FILES = import.meta.glob<string>(
  ["/src/content/guide/**/*.md", "!/src/content/guide/README.md"],
  { query: "?raw", import: "default", eager: true },
);
const GUIDE_FILE_PREFIX = "/src/content/guide/";

const filesById = new Map(
  Object.entries(GUIDE_FILES).map(([path, text]) => [
    path.slice(GUIDE_FILE_PREFIX.length, -".md".length),
    text,
  ]),
);

describe("guide topics", () => {
  it("has a Markdown file for every topic, and a topic for every file", () => {
    expect([...filesById.keys()].toSorted()).toEqual(
      Object.values(GuideTopic).toSorted(),
    );
  });

  it("gives every file a title and an order", () => {
    for (const [id, text] of filesById) {
      expect(text, id).toMatch(/^---\n(?:.*\n)*?title: .+\n/);
      expect(text, id).toMatch(/^---\n(?:.*\n)*?order: \d+\n/);
    }
  });

  it("puts every topic in a section", () => {
    const folders = GUIDE_SECTIONS.map((section) => section.folder);

    for (const topic of Object.values(GuideTopic)) {
      expect(folders, topic).toContain(topic.split("/")[0]);
    }
  });
});

describe("toGuideAnchor", () => {
  it("turns a topic's path into an anchor", () => {
    expect(toGuideAnchor(GuideTopic.HouseSystem)).toBe("settings-house-system");
  });
});
