// The guide: one Markdown file per topic under src/content/guide/. Its
// README is for whoever edits the guide, so it's left out.

import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { defineCollection } from "astro:content";

const guide = defineCollection({
  loader: glob({
    base: "./src/content/guide",
    pattern: ["**/*.md", "!README.md"],
  }),
  schema: z.object({
    title: z.string(),
    /** Its place within its section on the guide page. */
    order: z.number(),
  }),
});

export const collections = { guide };
