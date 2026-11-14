// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CompositeView from "@/components/CompositeView.svelte";
import { HouseSystem } from "@/lib/houses";

import { CHART, COMPOSITE } from "./fixtures/chart";

describe("CompositeView", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("draws one wheel, with its positions and aspects", () => {
    render(CompositeView, { composite: COMPOSITE });

    expect(
      screen.getByRole("heading", { name: "Composite chart" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "Composite chart wheel" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Composite positions" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Aspects" })).toBeTruthy();
  });

  it("says how it was made", () => {
    render(CompositeView, { composite: COMPOSITE });

    expect(screen.getByText(/midpoint of yours and theirs/)).toBeTruthy();
  });

  it("says when its houses fell back near the pole", () => {
    const composite = {
      ...COMPOSITE,
      houses: { ...COMPOSITE.houses!, houseSystem: HouseSystem.Porphyry },
      first: {
        ...CHART,
        details: { ...CHART.details, houseSystem: HouseSystem.Placidus },
      },
    };

    render(CompositeView, { composite });

    expect(screen.getByText(/so the composite uses Porphyry/)).toBeTruthy();
  });

  it("says why it has no houses without both birth times", () => {
    render(CompositeView, {
      composite: { ...COMPOSITE, houses: undefined },
    });

    expect(screen.getByText(/needs both birth times/)).toBeTruthy();
  });

  it("shares a link that reopens the composite", async () => {
    render(CompositeView, { composite: COMPOSITE });

    await fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("&comparison=composite"),
    );
  });
});
