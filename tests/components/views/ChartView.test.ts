// @vitest-environment jsdom

import { render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ChartView from "@/components/views/ChartView.svelte";

import { CHART, POLAR_CHART } from "../../fixtures/chart";

const FALLBACK_NOTE =
  /Placidus houses can't be cast this close to the pole, so these are Porphyry houses/;

describe("ChartView", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("names the house system it was asked for", () => {
    render(ChartView, { chart: CHART });

    expect(screen.getByText(/· Equal$/)).toBeTruthy();
    expect(screen.queryByText(FALLBACK_NOTE)).toBeNull();
  });

  it("names the house system a polar chart fell back to", () => {
    render(ChartView, { chart: POLAR_CHART });

    expect(screen.getByText(/· Porphyry$/)).toBeTruthy();
    expect(screen.queryByText(/· Placidus$/)).toBeNull();
    expect(screen.getByText(FALLBACK_NOTE)).toBeTruthy();
  });
});
