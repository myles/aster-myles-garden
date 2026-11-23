import { describe, expect, it } from "vitest";

import { groupGuideSections, toGuideEntries } from "@/components/guide/entries";
import { GuideTopic } from "@/components/guide/topics";

function entry(id: string, order: number, html = `<p>${id}</p>`) {
  return { id, data: { title: id, order }, rendered: { html } };
}

describe("toGuideEntries", () => {
  it("keys each topic's title and HTML by its id", () => {
    const entries = toGuideEntries([entry(GuideTopic.Orbs, 4)]);

    expect(entries[GuideTopic.Orbs]).toEqual({
      title: GuideTopic.Orbs,
      html: `<p>${GuideTopic.Orbs}</p>`,
    });
  });

  it("refuses an entry that wasn't rendered", () => {
    const unrendered = {
      id: GuideTopic.Orbs,
      data: { title: "Orbs", order: 1 },
    };

    expect(() => toGuideEntries([unrendered])).toThrow(
      "The guide topic settings/orbs has no rendered HTML.",
    );
  });
});

describe("groupGuideSections", () => {
  it("puts entries in their sections, in order", () => {
    const sections = groupGuideSections([
      entry(GuideTopic.Orbs, 4),
      entry(GuideTopic.BirthTime, 2),
      entry(GuideTopic.HouseSystem, 1),
      entry(GuideTopic.BirthDate, 1),
    ]);

    expect(
      sections.map((section) => [
        section.heading,
        section.entries.map((item) => item.id),
      ]),
    ).toEqual([
      ["Birth details", [GuideTopic.BirthDate, GuideTopic.BirthTime]],
      ["Chart settings", [GuideTopic.HouseSystem, GuideTopic.Orbs]],
    ]);
  });
});
