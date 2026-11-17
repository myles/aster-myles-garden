// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TransitView from "@/components/views/TransitView.svelte";

import { CHART_WITHOUT_TIME, TRANSITS } from "../../fixtures/chart";

const TIME_ZONE = "America/Toronto";

function table(name: string): HTMLElement {
  const heading = screen.getByRole("heading", { name });
  return heading.parentElement!.querySelector("table")!;
}

describe("TransitView", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("says when, on the visitor's clock", () => {
    render(TransitView, { transits: TRANSITS, timeZone: TIME_ZONE });

    expect(screen.getByText(/13 November 2026 at 15:05 EST/)).toBeTruthy();
  });

  it("draws a transit bi-wheel", () => {
    render(TransitView, { transits: TRANSITS, timeZone: TIME_ZONE });

    expect(screen.getByRole("img", { name: "Transit wheel" })).toBeTruthy();
  });

  it("lists transits, transiting body first", () => {
    render(TransitView, { transits: TRANSITS, timeZone: TIME_ZONE });

    const [, row] = within(table("Transits to your chart")).getAllByRole("row");
    const cells = within(row).getAllByRole("cell");
    expect(cells.slice(0, 5).map((cell) => cell.textContent?.trim())).toEqual([
      "☉︎ Sun",
      "□︎ Square",
      "♂︎ Mars",
      "1° 30′",
      "15 Nov 2026, 04:30",
    ]);
    expect(cells[5].textContent?.trim()).toMatch(/^11\s*–\s*16 Nov 2026$/);
  });

  it("lists each exact moment of a transit that's exact more than once", () => {
    const [aspect] = TRANSITS.aspects;
    const transits = {
      ...TRANSITS,
      aspects: [
        {
          ...aspect,
          timing: {
            ...aspect.timing,
            exact: [
              new Date("2026-03-01T17:00:00Z"),
              new Date("2026-07-20T16:00:00Z"),
              new Date("2026-12-05T17:00:00Z"),
            ],
          },
        },
      ],
    };

    render(TransitView, { transits, timeZone: TIME_ZONE });

    const [, row] = within(table("Transits to your chart")).getAllByRole("row");
    expect(within(row).getAllByRole("cell")[4].textContent).toMatch(
      /1 Mar 2026, 12:00.*20 Jul 2026, 12:00.*5 Dec 2026, 12:00/,
    );
  });

  it("says when a transit turns back before reaching exact", () => {
    const [aspect] = TRANSITS.aspects;
    const transits = {
      ...TRANSITS,
      aspects: [{ ...aspect, timing: { ...aspect.timing, exact: [] } }],
    };

    render(TransitView, { transits, timeZone: TIME_ZONE });

    expect(screen.getByText("Not this pass")).toBeTruthy();
  });

  it("places the transiting planets in your houses", () => {
    render(TransitView, { transits: TRANSITS, timeZone: TIME_ZONE });

    expect(
      within(table("Transiting positions")).getByRole("columnheader", {
        name: "Your house",
      }),
    ).toBeTruthy();
  });

  it("explains missing houses without a birth time", () => {
    render(TransitView, {
      transits: {
        ...TRANSITS,
        natal: CHART_WITHOUT_TIME,
        inNatalHouses: undefined,
      },
      timeZone: TIME_ZONE,
    });

    expect(screen.getByText(/your chart has no houses/)).toBeTruthy();
    expect(
      within(table("Transiting positions")).queryByRole("columnheader", {
        name: "Your house",
      }),
    ).toBeNull();
  });

  it("shares a link to these transits", async () => {
    render(TransitView, { transits: TRANSITS, timeZone: TIME_ZONE });

    await fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(
      screen.getByLabelText<HTMLInputElement>("Share link").value,
    ).toContain("&transits=2026-11-13T20:05Z");
  });
});
