// @vitest-environment jsdom

import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import ChartSettingsFields from "@/components/panels/ChartSettingsFields.svelte";
import { TROPICAL } from "@/components/panels/zodiac";
import { AspectSet, OrbSize } from "@/lib/astrology/aspects";
import { Ayanamsa } from "@/lib/astrology/ayanamsa";
import { HouseSystem } from "@/lib/astrology/houses";

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
});
