// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "@/components/App.svelte";
import { createChart, loadChartEngine } from "@/lib/chart";
import { HouseSystem } from "@/lib/houses";
import { loadPlaceIndex } from "@/lib/places";

import { CHART } from "./fixtures/chart";
import { PLACE_INDEX } from "./fixtures/places";

vi.mock("@/lib/chart", () => ({
  createChart: vi.fn(),
  loadChartEngine: vi.fn(),
}));

vi.mock("@/lib/places", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/places")>()),
  loadPlaceIndex: vi.fn(),
}));

async function fillDateTime(): Promise<void> {
  await fireEvent.input(screen.getByLabelText("Date"), {
    target: { value: "2000-01-01" },
  });
  await fireEvent.input(screen.getByLabelText("Time"), {
    target: { value: "12:00" },
  });
}

async function choosePlace(): Promise<void> {
  const input = screen.getByLabelText("Place");
  await fireEvent.focus(input);
  await vi.waitFor(() =>
    expect(screen.queryByText("Loading places…")).toBeNull(),
  );
  await fireEvent.input(input, { target: { value: "london, england" } });
  await fireEvent.keyDown(input, { key: "Enter" });
}

function submit(): Promise<boolean> {
  return fireEvent.click(screen.getByRole("button", { name: "Draw chart" }));
}

describe("App", () => {
  beforeEach(() => {
    vi.mocked(loadChartEngine).mockReset().mockResolvedValue();
    vi.mocked(createChart).mockReset().mockReturnValue(CHART);
    vi.mocked(loadPlaceIndex).mockReset().mockResolvedValue(PLACE_INDEX);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("asks for a date and time first", async () => {
    render(App);

    await submit();

    expect(screen.getByRole("alert").textContent).toContain(
      "Enter both a date and a time.",
    );
    expect(createChart).not.toHaveBeenCalled();
  });

  it("asks for a place from the list", async () => {
    render(App);

    await fillDateTime();
    await submit();

    expect(screen.getByRole("alert").textContent).toContain(
      "Choose a place from the list.",
    );
  });

  it("draws the chart, wheel and tables", async () => {
    render(App);

    await fillDateTime();
    await choosePlace();
    await submit();

    expect(
      await screen.findByRole("heading", { name: CHART_HEADING }),
    ).toBeTruthy();
    expect(createChart).toHaveBeenCalledWith({
      local: { year: 2000, month: 1, day: 1, hour: 12, minute: 0 },
      place: expect.objectContaining({ name: "London", region: "England" }),
      houseSystem: HouseSystem.Placidus,
    });
    expect(screen.getByRole("img", { name: "Natal chart wheel" })).toBeTruthy();
    expect(screen.getByText("Opposition", { exact: false })).toBeTruthy();
  });

  it("redraws when the house system changes", async () => {
    render(App);

    await fillDateTime();
    await choosePlace();
    await submit();
    await screen.findByRole("heading", { name: CHART_HEADING });

    await fireEvent.change(screen.getByLabelText("House system"), {
      target: { value: HouseSystem.Koch },
    });

    await vi.waitFor(() =>
      expect(createChart).toHaveBeenLastCalledWith(
        expect.objectContaining({ houseSystem: HouseSystem.Koch }),
      ),
    );
  });

  it("reports a calculator that fails to load", async () => {
    vi.mocked(loadChartEngine).mockRejectedValue(new Error("No WASM"));
    render(App);

    await fireEvent.focusIn(screen.getByLabelText("Date"));

    await vi.waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Couldn't load the calculator: No WASM",
      ),
    );
  });
});

const CHART_HEADING = "London, England, United Kingdom";

describe("App opened from a share link", () => {
  const SHARE_SEARCH = "?date=2000-01-01&time=12:00&place=6058560&house=koch";

  beforeEach(() => {
    vi.mocked(loadChartEngine).mockReset().mockResolvedValue();
    vi.mocked(createChart).mockReset().mockReturnValue(CHART);
    vi.mocked(loadPlaceIndex).mockReset().mockResolvedValue(PLACE_INDEX);
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  function openLink(search: string): void {
    window.history.replaceState(null, "", `/${search}`);
    render(App);
  }

  it("fills in the form and draws the chart", async () => {
    openLink(SHARE_SEARCH);

    await vi.waitFor(() =>
      expect(createChart).toHaveBeenCalledWith({
        local: { year: 2000, month: 1, day: 1, hour: 12, minute: 0 },
        place: expect.objectContaining({ id: 6058560, region: "Ontario" }),
        houseSystem: HouseSystem.Koch,
      }),
    );
    expect(screen.getByLabelText<HTMLInputElement>("Date").value).toBe(
      "2000-01-01",
    );
    expect(screen.getByLabelText<HTMLInputElement>("Time").value).toBe("12:00");
    expect(screen.getByLabelText<HTMLInputElement>("Place").value).toBe(
      "London, Ontario, Canada",
    );
    expect(screen.getByLabelText<HTMLSelectElement>("House system").value).toBe(
      HouseSystem.Koch,
    );
  });

  it("does nothing without a share link", async () => {
    openLink("");

    await Promise.resolve();

    expect(loadPlaceIndex).not.toHaveBeenCalled();
    expect(createChart).not.toHaveBeenCalled();
  });

  it("explains a damaged link", () => {
    openLink("?date=2000-01-01&time=noon&place=6058560");

    expect(screen.getByRole("alert").textContent).toContain(
      "Couldn't open the shared link: Invalid time",
    );
    expect(createChart).not.toHaveBeenCalled();
  });

  it("explains a place that isn't in the index", async () => {
    openLink("?date=2000-01-01&time=12:00&place=1");

    await vi.waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Couldn't open the shared link: No place has the ID 1.",
      ),
    );
    expect(createChart).not.toHaveBeenCalled();
  });
});
