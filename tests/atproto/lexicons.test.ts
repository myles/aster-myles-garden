import {
  LexiconIterableIndexer,
  LexiconSchemaBuilder,
  lexiconDocumentSchema,
} from "@atproto/lex-document";
import { describe, expect, it } from "vitest";

import chart from "@/experimental/atproto/lexicons/garden.myles.aster.chart.json";
import space from "@/experimental/atproto/lexicons/garden.myles.aster.space.json";
import {
  buildChartRecord,
  TimeDisclosure,
} from "@/experimental/atproto/record";

import { CHART } from "../fixtures/chart";
import { CONFIG } from "./fixtures";

describe("published Lexicon drafts", () => {
  it.each([chart, space])("validates $id with the pinned SDK", (document) => {
    expect(() => lexiconDocumentSchema.parse(document)).not.toThrow();
  });

  it("uses the SDK's title field for the myles.garden consent label", () => {
    expect(space.defs.main).toHaveProperty("title", "myles.garden");
    expect(space.defs.main).not.toHaveProperty("name");
    expect(space.defs.main.collections).toEqual([chart.id]);
    expect(space.id).toBe("garden.myles.aster.space");
    expect(CONFIG.spaceType).toBe(space.id);
  });

  it.each([TimeDisclosure.Include, TimeDisclosure.Omit])(
    "validates emitted records with %s time",
    async (disclosure) => {
      const document = lexiconDocumentSchema.parse(chart);
      const validator = await LexiconSchemaBuilder.build(
        new LexiconIterableIndexer([document]),
        `${chart.id}#main`,
      );
      const record = buildChartRecord(
        CHART.details,
        disclosure,
        new Date("2026-11-13T12:00:00Z"),
      );
      expect(() => validator.parse(record)).not.toThrow();
    },
  );
});
