// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import { GuideTopic, type GuideEntries } from "@/components/guide/topics";
import ChartSettingsFields from "@/components/panels/ChartSettingsFields.svelte";
import { TROPICAL } from "@/components/panels/zodiac";
import { AspectSet, OrbSize } from "@/lib/astrology/aspects";
import { Ayanamsa } from "@/lib/astrology/ayanamsa";
import { HouseSystem } from "@/lib/astrology/houses";

import SettingsHarness from "./SettingsHarness.svelte";

const GUIDE = {
  [GuideTopic.HouseSystem]: { title: "House system", html: "<p>Houses.</p>" },
  [GuideTopic.Zodiac]: { title: "Zodiac", html: "<p>Signs.</p>" },
  [GuideTopic.Aspects]: { title: "Aspects", html: "<p>Angles.</p>" },
  [GuideTopic.Orbs]: { title: "Orbs", html: "<p>Leeway.</p>" },
} as GuideEntries;

const DEFAULTS = {
  houseSystem: HouseSystem.Placidus,
  zodiac: TROPICAL,
  aspectSet: AspectSet.Major,
  orbSize: OrbSize.Standard,
  isHouseSystemUnused: false,
  note: "",
  onchange: () => {},
};

function summary(container: HTMLElement): string | undefined {
  return container
    .querySelector("[data-settings-summary]")
    ?.textContent?.trim();
}

describe("ChartSettingsFields", () => {
  it("starts collapsed", () => {
    const { container } = render(ChartSettingsFields, DEFAULTS);

    expect(container.querySelector("details")?.open).toBe(false);
  });

  it("sums up the settings while collapsed", () => {
    const { container } = render(ChartSettingsFields, DEFAULTS);

    expect(summary(container)).toBe(
      "Placidus · Tropical · Major aspects · Standard orbs",
    );
  });

  it("names a sidereal zodiac's ayanamsa and minor aspects", () => {
    const { container } = render(ChartSettingsFields, {
      ...DEFAULTS,
      houseSystem: HouseSystem.WholeSign,
      zodiac: Ayanamsa.Lahiri,
      aspectSet: AspectSet.All,
      orbSize: OrbSize.Wide,
    });

    expect(summary(container)).toBe(
      "Whole Sign · Sidereal (Lahiri) · Major and minor aspects · Wide orbs",
    );
  });

  it("leaves the house system out when there are no houses", () => {
    const { container } = render(ChartSettingsFields, {
      ...DEFAULTS,
      isHouseSystemUnused: true,
    });

    expect(summary(container)).toBe("Tropical · Major aspects · Standard orbs");
  });

  it("opens a setting's help across both columns, under its row", async () => {
    render(SettingsHarness, { guide: GUIDE });

    await fireEvent.click(screen.getByRole("button", { name: "About Orbs" }));

    const panel = screen.getByText("Leeway.").closest("[id]")!;
    expect(panel.classList).toContain("col-span-2");
    expect(
      screen
        .getByRole("button", { name: "About Orbs" })
        .getAttribute("aria-controls"),
    ).toBe(panel.id);
  });

  it("keeps one setting's help open at a time", async () => {
    render(SettingsHarness, { guide: GUIDE });

    await fireEvent.click(
      screen.getByRole("button", { name: "About House system" }),
    );
    await fireEvent.click(screen.getByRole("button", { name: "About Zodiac" }));

    expect(screen.queryByText("Houses.")).toBeNull();
    expect(screen.getByText("Signs.")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "About House system" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });
});
