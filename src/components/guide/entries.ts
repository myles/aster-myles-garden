// Turns the guide's content collection into what the app and the guide
// page need. Typed by shape, not by astro:content, so it can be tested.

import { GUIDE_SECTIONS, type GuideEntries } from "@/components/guide/topics";

/** A guide entry as getCollection("guide") gives it. */
export type GuideCollectionEntry = {
  id: string;
  data: { title: string; order: number };
  rendered?: { html: string };
};

/** Each topic's title and rendered HTML, by its id, for App. */
export function toGuideEntries(entries: GuideCollectionEntry[]): GuideEntries {
  const pairs = entries.map((entry) => {
    if (!entry.rendered) {
      throw new Error(`The guide topic ${entry.id} has no rendered HTML.`);
    }

    return [entry.id, { title: entry.data.title, html: entry.rendered.html }];
  });

  return Object.fromEntries(pairs) as GuideEntries;
}

/**
 * The guide page's sections, each with its entries in order. A section
 * with no entries is left out.
 */
export function groupGuideSections<Entry extends GuideCollectionEntry>(
  entries: Entry[],
): { heading: string; folder: string; entries: Entry[] }[] {
  return GUIDE_SECTIONS.map(({ heading, folder }) => ({
    heading,
    folder,
    entries: entries
      .filter((entry) => entry.id.startsWith(`${folder}/`))
      .toSorted((a, b) => a.data.order - b.data.order),
  })).filter((section) => section.entries.length > 0);
}
