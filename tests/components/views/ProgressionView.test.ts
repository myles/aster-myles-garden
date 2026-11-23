// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProgressionView from "@/components/views/ProgressionView.svelte";

import { CHART_WITHOUT_TIME, PROGRESSIONS } from "../../fixtures/chart";

function table(name: string): HTMLElement {
  const heading = screen.getByRole("heading", { name });
  // The heading shares a row with its guide toggle, above the table.
  return heading.parentElement!.parentElement!.querySelector("table")!;
}

describe("ProgressionView", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("says which date it's progressed to", () => {
    render(ProgressionView, { progressions: PROGRESSIONS });

    expect(screen.getByText(/Progressed to 14 November 2026/)).toBeTruthy();
  });

  it("draws a progressed bi-wheel", () => {
    render(ProgressionView, { progressions: PROGRESSIONS });

    expect(screen.getByRole("img", { name: "Progressed wheel" })).toBeTruthy();
  });

  it("lists progressions, progressed body first", () => {
    render(ProgressionView, { progressions: PROGRESSIONS });

    const [, row] = within(table("Progressions to your chart")).getAllByRole(
      "row",
    );
    const cells = within(row).getAllByRole("cell");
    expect(cells.map((cell) => cell.textContent?.trim())).toEqual([
      "☉︎ Sun",
      "⚻︎ Quincunx",
      "♂︎ Mars",
      "0° 30′",
    ]);
  });

  it("says so when nothing progressed is in orb", () => {
    render(ProgressionView, {
      progressions: { ...PROGRESSIONS, aspects: [] },
    });

    expect(screen.getByText("No progressions within orb.")).toBeTruthy();
  });

  it("places the progressed planets in your houses", () => {
    render(ProgressionView, { progressions: PROGRESSIONS });

    expect(
      within(table("Progressed positions")).getByRole("columnheader", {
        name: "Your house",
      }),
    ).toBeTruthy();
  });

  it("warns how far the Moon may be off without a birth time", () => {
    render(ProgressionView, {
      progressions: {
        ...PROGRESSIONS,
        natal: CHART_WITHOUT_TIME,
        inNatalHouses: undefined,
      },
    });

    expect(screen.getByText(/your chart has no houses/)).toBeTruthy();
    expect(screen.getByText(/progressed Moon could be/)).toBeTruthy();
  });

  it("shares a link to these progressions", async () => {
    render(ProgressionView, { progressions: PROGRESSIONS });

    await fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(
      screen.getByLabelText<HTMLInputElement>("Share link").value,
    ).toContain("&progressed=2026-11-14");
  });
});
