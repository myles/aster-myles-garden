// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SolarReturnView from "@/components/SolarReturnView.svelte";
import { HouseSystem } from "@/lib/houses";

import { CHART, SOLAR_RETURN } from "./fixtures/chart";

describe("SolarReturnView", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("draws the return's wheel, positions and aspects", () => {
    render(SolarReturnView, { solarReturn: SOLAR_RETURN });

    expect(
      screen.getByRole("heading", { name: "Solar return 2026" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "Solar return chart wheel" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Positions" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Aspects" })).toBeTruthy();
  });

  it("says where the Sun returns to", () => {
    render(SolarReturnView, { solarReturn: SOLAR_RETURN });

    expect(
      screen.getByText(/The Sun returns to 10° 00′ Capricorn/),
    ).toBeTruthy();
  });

  it("says when its houses fell back near the pole", () => {
    const chart = {
      ...CHART,
      details: { ...CHART.details, houseSystem: HouseSystem.Placidus },
      houses: { ...CHART.houses!, houseSystem: HouseSystem.Porphyry },
    };

    render(SolarReturnView, { solarReturn: { ...SOLAR_RETURN, chart } });

    expect(screen.getByText(/so the return uses Porphyry/)).toBeTruthy();
  });

  it("shares a link that reopens the return", async () => {
    render(SolarReturnView, { solarReturn: SOLAR_RETURN });

    await fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringMatching(/&return=2026$/),
    );
  });
});
