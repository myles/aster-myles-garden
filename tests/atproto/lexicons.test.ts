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
import geo from "../fixtures/lexicons/community.lexicon.location.geo.json";
import ai from "../fixtures/lexicons/community.lexicon.preference.ai.json";
import { CONFIG } from "./fixtures";

describe("published Lexicon drafts", () => {
  it.each([chart, space, geo, ai])(
    "validates $id with the pinned SDK",
    (document) => {
      expect(() => lexiconDocumentSchema.parse(document)).not.toThrow();
    },
  );

  it("uses the SDK's title field for the Aster consent label", () => {
    expect(space.defs.main).toHaveProperty("title", "aster.myles.garden");
    expect(space.defs.main).not.toHaveProperty("name");
    expect(space.defs.main.collections).toEqual([chart.id]);
    expect(space.id).toBe("garden.myles.aster.space");
    expect(CONFIG.spaceType).toBe(space.id);
  });

  it("defines inference consent and default-deny behaviour", () => {
    expect(
      chart.defs.main.record.properties.aiPreferences.description,
    ).toContain("hosted LLM");
    expect(
      chart.defs.main.record.properties.aiPreferences.description,
    ).toContain("horoscope");
    expect(
      chart.defs.main.record.properties.aiPreferences.description,
    ).toContain("omitted preferences");
  });

  it.each([TimeDisclosure.Include, TimeDisclosure.Omit])(
    "validates emitted records with %s time",
    async (disclosure) => {
      const document = lexiconDocumentSchema.parse(chart);
      const validator = await LexiconSchemaBuilder.build(
        new LexiconIterableIndexer([
          document,
          lexiconDocumentSchema.parse(geo),
          lexiconDocumentSchema.parse(ai),
        ]),
        `${chart.id}#main`,
      );
      const record = buildChartRecord(
        {
          ...CHART.details,
          aiPreferences: {
            training: { allow: false, updatedAt: "2026-11-13T12:00:00Z" },
          },
        },
        disclosure,
        new Date("2026-11-13T12:00:00Z"),
      );
      expect(() => validator.parse(record)).not.toThrow();
    },
  );
});
