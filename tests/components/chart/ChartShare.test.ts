// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ChartShare from "@/components/chart/ChartShare.svelte";
import { HouseSystem } from "@/lib/astrology/houses";

import { CHART } from "../../fixtures/chart";

const SHARE_URL =
  "https://aster.myles.garden/#date=2000-01-01&time=12:00" +
  "&place=2643743&house=equal";

describe("ChartShare", () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("makes no link until the button is pressed", () => {
    render(ChartShare, { details: CHART.details });

    expect(screen.queryByLabelText("Share link")).toBeNull();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies the link and shows it", async () => {
    render(ChartShare, { details: CHART.details });

    await press();

    expect(writeText).toHaveBeenCalledWith(SHARE_URL);
    expect(screen.getByLabelText<HTMLInputElement>("Share link").value).toBe(
      SHARE_URL,
    );
    await vi.waitFor(() =>
      expect(screen.getByText("Link copied.")).toBeTruthy(),
    );
  });

  it("still shows the link when copying fails", async () => {
    writeText.mockRejectedValue(new Error("Denied"));
    render(ChartShare, { details: CHART.details });

    await press();

    await vi.waitFor(() =>
      expect(
        screen.getByText("Couldn't copy the link (Denied). Copy it below."),
      ).toBeTruthy(),
    );
    expect(screen.getByLabelText<HTMLInputElement>("Share link").value).toBe(
      SHARE_URL,
    );
  });

  it("drops a stale link when the chart changes", async () => {
    const { rerender } = render(ChartShare, { details: CHART.details });
    await press();

    await rerender({
      details: { ...CHART.details, houseSystem: HouseSystem.Koch },
    });

    expect(screen.queryByLabelText("Share link")).toBeNull();
  });
});

function press(): Promise<boolean> {
  return fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
}
