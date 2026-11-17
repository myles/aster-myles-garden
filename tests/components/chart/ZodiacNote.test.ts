// @vitest-environment jsdom

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import ZodiacNote from "@/components/chart/ZodiacNote.svelte";
import { Ayanamsa } from "@/lib/astrology/ayanamsa";

import { CHART } from "../../fixtures/chart";

describe("ZodiacNote", () => {
  it("says nothing for the tropical zodiac", () => {
    const { container } = render(ZodiacNote, { chart: CHART });

    expect(container.textContent?.trim()).toBe("");
  });

  it("names the ayanamsa and how far behind it is", () => {
    const chart = {
      ...CHART,
      details: { ...CHART.details, ayanamsa: Ayanamsa.Lahiri },
      ayanamsaDegrees: 23.86,
    };

    render(ZodiacNote, { chart });

    expect(
      screen.getByText(
        "Sidereal zodiac, Lahiri ayanamsa: 23° 52′ behind the tropical.",
      ),
    ).toBeTruthy();
  });
});
