// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ComparisonView from "@/components/views/ComparisonView.svelte";
import { HouseSystem } from "@/lib/astrology/houses";
import { compareCharts } from "@/lib/charts/synastry";

import { CHART, CHART_WITHOUT_TIME, POLAR_CHART } from "../../fixtures/chart";

// Their Sun at 190° squares your Sun and Mars.
const THEIRS = {
  ...CHART,
  bodies: [{ ...CHART.bodies[0], longitude: 190, house: 7 }],
};

function table(name: string): HTMLElement {
  const heading = screen.getByRole("heading", { name });
  // The heading shares a row with its guide toggle, above the table.
  return heading.parentElement!.parentElement!.querySelector("table")!;
}

describe("ComparisonView", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("draws a bi-wheel", () => {
    render(ComparisonView, { synastry: compareCharts(CHART, THEIRS) });

    expect(
      screen.getByRole("img", { name: "Chart comparison wheel" }),
    ).toBeTruthy();
  });

  it("lists the aspects between you", () => {
    render(ComparisonView, { synastry: compareCharts(CHART, THEIRS) });

    const rows = within(table("Aspects between you")).getAllByRole("row");
    expect(rows).toHaveLength(1 + 2);
    expect(rows[1].textContent).toContain("Square");
  });

  it("places each person's planets in the other's houses", () => {
    render(ComparisonView, { synastry: compareCharts(CHART, THEIRS) });

    expect(
      within(table("Your positions")).getByRole("columnheader", {
        name: "Their house",
      }),
    ).toBeTruthy();
    expect(
      within(table("Their positions")).getByRole("columnheader", {
        name: "Your house",
      }),
    ).toBeTruthy();
  });

  it("explains and drops overlays into a chart without a time", () => {
    render(ComparisonView, {
      synastry: compareCharts(CHART_WITHOUT_TIME, THEIRS),
    });

    expect(
      screen.getByText(/without a birth time is cast for noon/),
    ).toBeTruthy();
    expect(
      within(table("Their positions")).queryByRole("columnheader", {
        name: "Your house",
      }),
    ).toBeNull();
  });

  it("says when a chart's houses fell back to Porphyry", () => {
    // Asked for Placidus too, at a latitude where it can be cast.
    const theirs = {
      ...POLAR_CHART,
      houses: { ...POLAR_CHART.houses!, houseSystem: HouseSystem.Placidus },
    };

    render(ComparisonView, { synastry: compareCharts(POLAR_CHART, theirs) });

    expect(screen.getByText(/^Porphyry houses\./)).toBeTruthy();
    expect(
      screen.getByText(
        /Placidus houses can't be cast this close to the pole, so your chart uses Porphyry houses/,
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/their chart uses Porphyry/)).toBeNull();
  });

  it("names the house system both charts use", () => {
    render(ComparisonView, { synastry: compareCharts(CHART, THEIRS) });

    expect(screen.getByText(/^Equal houses\./)).toBeTruthy();
    expect(screen.queryByText(/can't be cast this close/)).toBeNull();
  });

  it("shares a link to the whole comparison", async () => {
    render(ComparisonView, { synastry: compareCharts(CHART, THEIRS) });

    await fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(
      screen.getByLabelText<HTMLInputElement>("Share link").value,
    ).toContain("&date2=2000-01-01&time2=12:00&place2=2643743");
  });
});
