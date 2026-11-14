// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "@/components/App.svelte";
import { AspectSet, DEFAULT_ASPECT_SETTINGS, OrbSize } from "@/lib/aspects";
import { createChart, loadChartEngine } from "@/lib/chart";
import { createComposite } from "@/lib/composite";
import { HouseSystem } from "@/lib/houses";
import { loadPlaceIndex } from "@/lib/places";
import { addSavedChart, readSavedCharts } from "@/lib/saved-charts";
import { toUtc } from "@/lib/time";
import { createTransits } from "@/lib/transits";

import {
  CHART,
  CHART_WITHOUT_TIME,
  COMPOSITE,
  TRANSITS,
} from "./fixtures/chart";
import { PLACE_INDEX } from "./fixtures/places";

vi.mock("@/lib/chart", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/chart")>()),
  createChart: vi.fn(),
  loadChartEngine: vi.fn(),
}));

// A zone far from UTC, so reading the clock in the wrong zone shows up.
const VISITOR_TIME_ZONE = "Asia/Tokyo";

vi.mock("@/lib/time", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/time")>()),
  getLocalTimeZone: () => VISITOR_TIME_ZONE,
}));

// The real one needs the WASM engine, which these tests never load.
vi.mock("@/lib/transits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/transits")>()),
  createTransits: vi.fn(),
}));

vi.mock("@/lib/composite", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/composite")>()),
  createComposite: vi.fn(),
}));

vi.mock("@/lib/places", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/places")>()),
  loadPlaceIndex: vi.fn(),
}));

/**
 * jsdom has no layout, so it has no matchMedia either. A narrow layout
 * stacks the result below the forms, as on a phone.
 */
function stubLayout(isNarrow: boolean): void {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: isNarrow }) as unknown as typeof matchMedia;
}

function wasScrolledTo(element: Element): boolean {
  return vi
    .mocked(Element.prototype.scrollIntoView)
    .mock.contexts.includes(element);
}

// Saved charts live in localStorage, which jsdom keeps between tests.
beforeEach(() => {
  localStorage.clear();
  stubLayout(false);
});

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

const OUT_OF_RANGE_TEXT = /about 3000 BCE to 3000 CE/;

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

  it("enables the birth controls after hydration", () => {
    render(App);

    const form = screen.getByRole("form", { name: "Your birth details" });
    expect(form.querySelector("fieldset")?.disabled).toBe(false);
    expect(screen.getByLabelText("Date").matches(":disabled")).toBe(false);
    expect(
      screen.getByRole("button", { name: "Draw chart" }).matches(":disabled"),
    ).toBe(false);
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
      "Choose a place from the list, or enter its coordinates.",
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
      date: { year: 2000, month: 1, day: 1 },
      time: { hour: 12, minute: 0 },
      place: expect.objectContaining({ name: "London", region: "England" }),
      houseSystem: HouseSystem.Placidus,
      aspectSettings: DEFAULT_ASPECT_SETTINGS,
    });
    expect(screen.getByRole("img", { name: "Natal chart wheel" })).toBeTruthy();
    expect(screen.getByText("Opposition", { exact: false })).toBeTruthy();
  });

  it("asks for a time, or for the box to be ticked", async () => {
    render(App);

    await fireEvent.input(screen.getByLabelText("Date"), {
      target: { value: "2000-01-01" },
    });
    await submit();

    expect(screen.getByRole("alert").textContent).toContain(
      "Enter a time, or tick “I don't know the time”.",
    );
  });

  it("draws a chart without a birth time", async () => {
    vi.mocked(createChart).mockReturnValue(CHART_WITHOUT_TIME);
    render(App);

    await fireEvent.input(screen.getByLabelText("Date"), {
      target: { value: "2000-01-01" },
    });
    await fireEvent.click(screen.getByLabelText("I don't know the time"));
    await choosePlace();
    await submit();

    expect(createChart).toHaveBeenCalledWith(
      expect.objectContaining({
        date: { year: 2000, month: 1, day: 1 },
        time: undefined,
      }),
    );
    expect(await screen.findByText(/this chart is cast for noon/)).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "House" })).toBeNull();
    expect(screen.queryByText("Ascendant")).toBeNull();
    expect(screen.getByText("10° 00′ Cancer ℞ (may be Leo)")).toBeTruthy();
  });

  it("disables the time and house system without a birth time", async () => {
    render(App);

    await fireEvent.click(screen.getByLabelText("I don't know the time"));

    expect(screen.getByLabelText<HTMLInputElement>("Time").disabled).toBe(true);
    expect(
      screen.getByLabelText<HTMLSelectElement>("House system").disabled,
    ).toBe(true);
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

  it("redraws when the aspect settings change", async () => {
    render(App);

    await fillDateTime();
    await choosePlace();
    await submit();
    await screen.findByRole("heading", { name: CHART_HEADING });

    await fireEvent.change(screen.getByLabelText("Aspects"), {
      target: { value: AspectSet.All },
    });
    await fireEvent.change(screen.getByLabelText("Orbs"), {
      target: { value: OrbSize.Tight },
    });

    await vi.waitFor(() =>
      expect(createChart).toHaveBeenLastCalledWith(
        expect.objectContaining({
          aspectSettings: { aspectSet: AspectSet.All, orbSize: OrbSize.Tight },
        }),
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
  const SHARE_HASH = "#date=2000-01-01&time=12:00&place=6058560&house=koch";

  beforeEach(() => {
    vi.mocked(loadChartEngine).mockReset().mockResolvedValue();
    vi.mocked(createChart).mockReset().mockReturnValue(CHART);
    vi.mocked(loadPlaceIndex).mockReset().mockResolvedValue(PLACE_INDEX);
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  function openLink(hash: string): void {
    window.history.replaceState(null, "", `/${hash}`);
    render(App);
  }

  it("fills in the form and draws the chart", async () => {
    openLink(SHARE_HASH);

    await vi.waitFor(() =>
      expect(createChart).toHaveBeenCalledWith({
        date: { year: 2000, month: 1, day: 1 },
        time: { hour: 12, minute: 0 },
        place: expect.objectContaining({ id: 6058560, region: "Ontario" }),
        houseSystem: HouseSystem.Koch,
        aspectSettings: DEFAULT_ASPECT_SETTINGS,
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

  it("takes the link's aspect settings", async () => {
    openLink(`${SHARE_HASH}&aspects=all&orbs=wide`);

    await vi.waitFor(() =>
      expect(createChart).toHaveBeenCalledWith(
        expect.objectContaining({
          aspectSettings: { aspectSet: AspectSet.All, orbSize: OrbSize.Wide },
        }),
      ),
    );
    expect(screen.getByLabelText<HTMLSelectElement>("Aspects").value).toBe(
      AspectSet.All,
    );
    expect(screen.getByLabelText<HTMLSelectElement>("Orbs").value).toBe(
      OrbSize.Wide,
    );
  });

  it("follows a share link opened on the same page", async () => {
    openLink("");

    window.location.hash = SHARE_HASH;

    await vi.waitFor(() =>
      expect(createChart).toHaveBeenCalledWith(
        expect.objectContaining({ houseSystem: HouseSystem.Koch }),
      ),
    );
  });

  it("opens a link without a birth time", async () => {
    openLink("#date=2000-01-01&time=unknown&place=6058560");

    await vi.waitFor(() =>
      expect(createChart).toHaveBeenCalledWith(
        expect.objectContaining({ time: undefined }),
      ),
    );
    expect(
      screen.getByLabelText<HTMLInputElement>("I don't know the time").checked,
    ).toBe(true);
  });

  it("does nothing without a share link", async () => {
    openLink("");

    await Promise.resolve();

    expect(loadPlaceIndex).not.toHaveBeenCalled();
    expect(createChart).not.toHaveBeenCalled();
  });

  it("explains a damaged link", () => {
    openLink("#date=2000-01-01&time=noon&place=6058560");

    expect(screen.getByRole("alert").textContent).toContain(
      "Couldn't open the shared link: Invalid time",
    );
    expect(createChart).not.toHaveBeenCalled();
  });

  it("explains a place that isn't in the index", async () => {
    openLink("#date=2000-01-01&time=12:00&place=1");

    await vi.waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Couldn't open the shared link: No place has the ID 1.",
      ),
    );
    expect(createChart).not.toHaveBeenCalled();
  });
});

describe("App comparing two charts", () => {
  beforeEach(() => {
    vi.mocked(loadChartEngine).mockReset().mockResolvedValue();
    vi.mocked(createChart).mockReset().mockReturnValue(CHART);
    vi.mocked(createComposite).mockReset().mockReturnValue(COMPOSITE);
    vi.mocked(loadPlaceIndex).mockReset().mockResolvedValue(PLACE_INDEX);
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  function theirForm(): HTMLElement {
    return screen.getByRole("form", { name: "Their birth details" });
  }

  async function drawYourChart(): Promise<void> {
    await fillDateTime();
    await choosePlace();
    await submit();
    await screen.findByRole("heading", { name: CHART_HEADING });
  }

  async function fillTheirForm(): Promise<void> {
    const form = within(theirForm());
    await fireEvent.input(form.getByLabelText("Date"), {
      target: { value: "1990-05-15" },
    });
    await fireEvent.input(form.getByLabelText("Time"), {
      target: { value: "14:30" },
    });

    const place = form.getByLabelText("Place");
    await fireEvent.focus(place);
    await fireEvent.input(place, { target: { value: "toronto" } });
    await fireEvent.keyDown(place, { key: "Enter" });
  }

  function pressCompare(): Promise<boolean> {
    return fireEvent.click(
      within(theirForm()).getByRole("button", { name: "Compare charts" }),
    );
  }

  it("offers a comparison only once your chart is drawn", async () => {
    render(App);
    const compare = () =>
      screen.queryByRole("button", { name: "Compare with someone else" });

    expect(compare()).toBeNull();

    await drawYourChart();

    expect(compare()).toBeTruthy();
  });

  it("opens their form below yours, ready to type", async () => {
    render(App);
    await drawYourChart();

    await fireEvent.click(
      screen.getByRole("button", { name: "Compare with someone else" }),
    );

    expect(theirForm()).toBeTruthy();
    await vi.waitFor(() =>
      expect(document.activeElement?.id).toBe("compare-date"),
    );
  });

  it("brings the comparison into view on a narrow layout", async () => {
    render(App);
    await drawYourChart();
    stubLayout(true);
    await fireEvent.click(
      screen.getByRole("button", { name: "Compare with someone else" }),
    );

    await fillTheirForm();
    await pressCompare();

    const heading = await screen.findByRole("heading", {
      name: "Chart comparison",
    });
    await vi.waitFor(() => expect(document.activeElement).toBe(heading));
    expect(wasScrolledTo(heading)).toBe(true);
  });

  it("draws the comparison with your house system", async () => {
    render(App);
    await drawYourChart();
    await fireEvent.click(
      screen.getByRole("button", { name: "Compare with someone else" }),
    );

    await fillTheirForm();
    await pressCompare();

    expect(
      await screen.findByRole("heading", { name: "Chart comparison" }),
    ).toBeTruthy();
    expect(createChart).toHaveBeenLastCalledWith({
      date: { year: 1990, month: 5, day: 15 },
      time: { hour: 14, minute: 30 },
      place: expect.objectContaining({ name: "Toronto" }),
      houseSystem: HouseSystem.Placidus,
      aspectSettings: DEFAULT_ASPECT_SETTINGS,
    });
    expect(
      screen.getByRole("img", { name: "Chart comparison wheel" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Aspects between you" }),
    ).toBeTruthy();
  });

  it("explains a problem in their form beside it", async () => {
    render(App);
    await drawYourChart();
    await fireEvent.click(
      screen.getByRole("button", { name: "Compare with someone else" }),
    );

    await pressCompare();

    expect(within(theirForm()).getByRole("alert").textContent).toContain(
      "Enter both a date and a time.",
    );
  });

  it("goes back to your chart when you stop comparing", async () => {
    render(App);
    await drawYourChart();
    await fireEvent.click(
      screen.getByRole("button", { name: "Compare with someone else" }),
    );
    await fillTheirForm();
    await pressCompare();
    await screen.findByRole("heading", { name: "Chart comparison" });

    await fireEvent.click(
      screen.getByRole("button", { name: "Stop comparing" }),
    );

    expect(
      screen.queryByRole("form", { name: "Their birth details" }),
    ).toBeNull();
    expect(screen.getByRole("heading", { name: CHART_HEADING })).toBeTruthy();
  });

  it("redraws both charts when the house system changes", async () => {
    render(App);
    await drawYourChart();
    await fireEvent.click(
      screen.getByRole("button", { name: "Compare with someone else" }),
    );
    await fillTheirForm();
    await pressCompare();
    await screen.findByRole("heading", { name: "Chart comparison" });
    vi.mocked(createChart).mockClear();

    await fireEvent.change(screen.getByLabelText("House system"), {
      target: { value: HouseSystem.Koch },
    });

    await vi.waitFor(() => expect(createChart).toHaveBeenCalledTimes(2));
    for (const [details] of vi.mocked(createChart).mock.calls) {
      expect(details.houseSystem).toBe(HouseSystem.Koch);
    }
  });

  it("keeps both charts when their place is cleared", async () => {
    render(App);
    await drawYourChart();
    await fireEvent.click(
      screen.getByRole("button", { name: "Compare with someone else" }),
    );
    await fillTheirForm();
    await pressCompare();
    await screen.findByRole("heading", { name: "Chart comparison" });
    vi.mocked(createChart).mockClear();

    await fireEvent.input(within(theirForm()).getByLabelText("Place"), {
      target: { value: "" },
    });
    await fireEvent.change(screen.getByLabelText("House system"), {
      target: { value: HouseSystem.Koch },
    });

    expect(createChart).not.toHaveBeenCalled();
    expect(within(theirForm()).getByRole("alert").textContent).toContain(
      "Choose a place from the list, or enter its coordinates.",
    );
    expect(screen.getByText(/Equal houses/)).toBeTruthy();
  });

  it("keeps both charts when their recalculation fails", async () => {
    render(App);
    await drawYourChart();
    await fireEvent.click(
      screen.getByRole("button", { name: "Compare with someone else" }),
    );
    await fillTheirForm();
    await pressCompare();
    await screen.findByRole("heading", { name: "Chart comparison" });
    const wheel = screen.getByRole("img", { name: "Chart comparison wheel" });
    const originalWheel = wheel.innerHTML;
    vi.mocked(createChart)
      .mockReturnValueOnce({
        ...CHART,
        details: { ...CHART.details, houseSystem: HouseSystem.Koch },
      })
      .mockImplementationOnce(() => {
        throw new Error("Calculation failed");
      });

    await fireEvent.change(screen.getByLabelText("House system"), {
      target: { value: HouseSystem.Koch },
    });

    await vi.waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Calculation failed",
      ),
    );
    expect(wheel.innerHTML).toBe(originalWheel);
    expect(screen.getByText(/Equal houses/)).toBeTruthy();
  });

  it("rebuilds both charts after repairing comparison details", async () => {
    render(App);
    await drawYourChart();
    await fireEvent.click(
      screen.getByRole("button", { name: "Compare with someone else" }),
    );
    await fillTheirForm();
    await pressCompare();
    await screen.findByRole("heading", { name: "Chart comparison" });
    await fireEvent.input(within(theirForm()).getByLabelText("Place"), {
      target: { value: "" },
    });
    await fireEvent.change(screen.getByLabelText("House system"), {
      target: { value: HouseSystem.Koch },
    });
    await fillTheirForm();
    vi.mocked(createChart).mockClear();
    await pressCompare();

    expect(createChart).toHaveBeenCalledTimes(2);
    for (const [details] of vi.mocked(createChart).mock.calls) {
      expect(details.houseSystem).toBe(HouseSystem.Koch);
    }
    expect(within(theirForm()).queryByRole("alert")).toBeNull();
  });

  async function compareWithThem(): Promise<void> {
    await drawYourChart();
    await fireEvent.click(
      screen.getByRole("button", { name: "Compare with someone else" }),
    );
    await fillTheirForm();
    await pressCompare();
    await screen.findByRole("heading", { name: "Chart comparison" });
  }

  it("shows the bi-wheel until the composite is chosen", async () => {
    render(App);
    await compareWithThem();

    expect(
      within(theirForm()).getByLabelText<HTMLInputElement>("Bi-wheel").checked,
    ).toBe(true);
    expect(createComposite).not.toHaveBeenCalled();
  });

  it("switches to the composite and back", async () => {
    render(App);
    await compareWithThem();

    await fireEvent.click(within(theirForm()).getByLabelText("Composite"));

    expect(
      await screen.findByRole("heading", { name: "Composite chart" }),
    ).toBeTruthy();
    expect(createComposite).toHaveBeenLastCalledWith(CHART, CHART);
    expect(
      screen.getByRole("img", { name: "Composite chart wheel" }),
    ).toBeTruthy();

    await fireEvent.click(within(theirForm()).getByLabelText("Bi-wheel"));

    expect(
      await screen.findByRole("heading", { name: "Chart comparison" }),
    ).toBeTruthy();
  });

  it("reports a composite that can't be cast", async () => {
    vi.mocked(createComposite).mockImplementation(() => {
      throw new Error("The engine gave up.");
    });
    render(App);
    await compareWithThem();

    await fireEvent.click(within(theirForm()).getByLabelText("Composite"));

    expect(within(theirForm()).getByRole("alert").textContent).toContain(
      "Couldn't draw the composite: The engine gave up.",
    );
  });

  it("opens a composite from a share link", async () => {
    window.history.replaceState(
      null,
      "",
      "/#date=2000-01-01&time=12:00&place=2643743" +
        "&date2=1990-05-15&time2=14:30&place2=6167865&comparison=composite",
    );
    render(App);

    expect(
      await screen.findByRole("heading", { name: "Composite chart" }),
    ).toBeTruthy();
    expect(
      within(theirForm()).getByLabelText<HTMLInputElement>("Composite").checked,
    ).toBe(true);
  });

  it("opens a comparison from a share link", async () => {
    window.history.replaceState(
      null,
      "",
      "/#date=2000-01-01&time=12:00&place=2643743&house=koch" +
        "&date2=1990-05-15&time2=unknown&place2=6167865",
    );
    render(App);

    expect(
      await screen.findByRole("heading", { name: "Chart comparison" }),
    ).toBeTruthy();
    expect(createChart).toHaveBeenLastCalledWith({
      date: { year: 1990, month: 5, day: 15 },
      time: undefined,
      place: expect.objectContaining({ name: "Toronto" }),
      houseSystem: HouseSystem.Koch,
      aspectSettings: DEFAULT_ASPECT_SETTINGS,
    });
    expect(
      within(theirForm()).getByLabelText<HTMLInputElement>(
        "I don't know the time",
      ).checked,
    ).toBe(true);
  });
});

describe("App showing transits", () => {
  beforeEach(() => {
    vi.mocked(loadChartEngine).mockReset().mockResolvedValue();
    vi.mocked(createChart).mockReset().mockReturnValue(CHART);
    vi.mocked(createTransits).mockReset().mockReturnValue(TRANSITS);
    vi.mocked(loadPlaceIndex).mockReset().mockResolvedValue(PLACE_INDEX);
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  function transitForm(): HTMLElement {
    return screen.getByRole("form", { name: "Transit moment" });
  }

  async function openTransits(): Promise<void> {
    render(App);
    await fillDateTime();
    await choosePlace();
    await submit();
    await screen.findByRole("heading", { name: CHART_HEADING });
    await fireEvent.click(screen.getByRole("button", { name: "See transits" }));
  }

  it("opens on the transits for right now", async () => {
    const before = Date.now();

    await openTransits();

    expect(
      await screen.findByRole("heading", { name: "Transits", level: 2 }),
    ).toBeTruthy();
    const [natal, at] = vi.mocked(createTransits).mock.lastCall!;
    expect(natal).toBe(CHART);
    expect(at.getTime()).toBeGreaterThanOrEqual(before);
    expect(at.getTime()).toBeLessThanOrEqual(Date.now());
    expect(document.activeElement?.id).toBe("transit-date");
  });

  it("shows transits for a moment on the visitor's clock", async () => {
    await openTransits();
    const form = within(transitForm());

    await fireEvent.input(form.getByLabelText("Date"), {
      target: { value: "2030-06-01" },
    });
    await fireEvent.input(form.getByLabelText("Time"), {
      target: { value: "09:30" },
    });
    await fireEvent.click(form.getByRole("button", { name: "Show transits" }));

    const expected = toUtc(
      { year: 2030, month: 6, day: 1, hour: 9, minute: 30 },
      VISITOR_TIME_ZONE,
    );
    await vi.waitFor(() =>
      expect(vi.mocked(createTransits).mock.lastCall?.[1]).toEqual(expected),
    );
  });

  it("asks for a date and time", async () => {
    await openTransits();
    const form = within(transitForm());

    await fireEvent.input(form.getByLabelText("Time"), {
      target: { value: "" },
    });
    await fireEvent.click(form.getByRole("button", { name: "Show transits" }));

    expect(form.getByRole("alert").textContent).toContain(
      "Enter both a date and a time.",
    );
  });

  it("goes back to your chart", async () => {
    await openTransits();

    await fireEvent.click(
      screen.getByRole("button", { name: "Back to your chart" }),
    );

    expect(screen.queryByRole("form", { name: "Transit moment" })).toBeNull();
    expect(screen.getByRole("heading", { name: CHART_HEADING })).toBeTruthy();
  });

  it("explains a transit date outside the engine's range", async () => {
    await openTransits();
    vi.mocked(createTransits).mockClear();
    const form = within(transitForm());

    await fireEvent.input(form.getByLabelText("Date"), {
      target: { value: "9999-06-01" },
    });
    await fireEvent.click(form.getByRole("button", { name: "Show transits" }));

    expect(form.getByRole("alert").textContent).toMatch(OUT_OF_RANGE_TEXT);
    expect(createTransits).not.toHaveBeenCalled();
  });

  it("reports a transit calculation that fails", async () => {
    vi.mocked(createTransits).mockImplementation(() => {
      throw new Error("The engine gave up.");
    });

    await openTransits();

    expect(within(transitForm()).getByRole("alert").textContent).toContain(
      "Couldn't show transits: The engine gave up.",
    );
  });

  it("explains a share link's transits outside the engine's range", async () => {
    window.history.replaceState(
      null,
      "",
      "/#date=2000-01-01&time=12:00&place=2643743&transits=9999-01-01T00:00Z",
    );
    render(App);

    const form = await screen.findByRole("form", { name: "Transit moment" });
    await vi.waitFor(() =>
      expect(within(form).getByRole("alert").textContent).toMatch(
        OUT_OF_RANGE_TEXT,
      ),
    );
    expect(createTransits).not.toHaveBeenCalled();
  });

  it("opens transits from a share link", async () => {
    window.history.replaceState(
      null,
      "",
      "/#date=2000-01-01&time=12:00&place=2643743&transits=2026-11-13T20:05Z",
    );
    render(App);

    expect(
      await screen.findByRole("heading", { name: "Transits", level: 2 }),
    ).toBeTruthy();
    expect(vi.mocked(createTransits).mock.lastCall?.[1]).toEqual(
      new Date("2026-11-13T20:05:00Z"),
    );
  });
});

describe("App with saved charts", () => {
  const TORONTO = PLACE_INDEX.entries[1].place;

  beforeEach(() => {
    vi.mocked(loadChartEngine).mockReset().mockResolvedValue();
    vi.mocked(createChart).mockReset().mockReturnValue(CHART);
    vi.mocked(loadPlaceIndex).mockReset().mockResolvedValue(PLACE_INDEX);
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function yourForm() {
    return within(screen.getByRole("form", { name: "Your birth details" }));
  }

  function saveAs(name: string): Promise<boolean> {
    return fireEvent.input(yourForm().getByLabelText("Save as"), {
      target: { value: name },
    });
  }

  it("saves your details under a name, in this browser", async () => {
    render(App);
    await fillDateTime();
    await choosePlace();

    await saveAs("Me");
    await fireEvent.click(yourForm().getByRole("button", { name: "Save" }));

    expect(yourForm().getByText("Saved “Me”.")).toBeTruthy();
    expect(yourForm().getByRole("button", { name: "Use Me" })).toBeTruthy();
    expect(readSavedCharts(localStorage)).toEqual([
      expect.objectContaining({
        name: "Me",
        date: "2000-01-01",
        time: "12:00",
        place: expect.objectContaining({ name: "London" }),
      }),
    ]);
  });

  it("saves on Enter without drawing the chart", async () => {
    render(App);
    await fillDateTime();
    await choosePlace();
    await saveAs("Me");

    // jsdom doesn't submit forms on Enter as browsers do, so check that
    // the key press was cancelled: fireEvent returns false when it was.
    const isNotCancelled = await fireEvent.keyDown(
      yourForm().getByLabelText("Save as"),
      { key: "Enter" },
    );

    expect(isNotCancelled).toBe(false);
    expect(readSavedCharts(localStorage)).toHaveLength(1);
    expect(createChart).not.toHaveBeenCalled();
  });

  it("won't save details that aren't complete", async () => {
    render(App);

    await saveAs("Me");
    await fireEvent.click(yourForm().getByRole("button", { name: "Save" }));

    expect(yourForm().getByText("Enter both a date and a time.")).toBeTruthy();
    expect(readSavedCharts(localStorage)).toEqual([]);
  });

  it("fills in and draws a saved chart", async () => {
    addSavedChart(localStorage, {
      name: "Sam",
      date: "1990-05-15",
      place: TORONTO,
    });
    render(App);

    await fireEvent.click(yourForm().getByRole("button", { name: "Use Sam" }));

    await vi.waitFor(() =>
      expect(createChart).toHaveBeenCalledWith({
        date: { year: 1990, month: 5, day: 15 },
        time: undefined,
        place: TORONTO,
        houseSystem: HouseSystem.Placidus,
        aspectSettings: DEFAULT_ASPECT_SETTINGS,
      }),
    );
    expect(yourForm().getByLabelText<HTMLInputElement>("Date").value).toBe(
      "1990-05-15",
    );
    expect(
      yourForm().getByLabelText<HTMLInputElement>("I don't know the time")
        .checked,
    ).toBe(true);
  });

  it("compares with a saved chart", async () => {
    addSavedChart(localStorage, {
      name: "Sam",
      date: "1990-05-15",
      time: "14:30",
      place: TORONTO,
    });
    render(App);
    await fillDateTime();
    await choosePlace();
    await submit();
    await screen.findByRole("heading", { name: CHART_HEADING });
    await fireEvent.click(
      screen.getByRole("button", { name: "Compare with someone else" }),
    );

    const theirs = within(
      screen.getByRole("form", { name: "Their birth details" }),
    );
    await fireEvent.click(theirs.getByRole("button", { name: "Use Sam" }));

    expect(
      await screen.findByRole("heading", { name: "Chart comparison" }),
    ).toBeTruthy();
    expect(createChart).toHaveBeenLastCalledWith(
      expect.objectContaining({ place: TORONTO }),
    );
  });

  it("forgets a saved chart", async () => {
    addSavedChart(localStorage, {
      name: "Sam",
      date: "1990-05-15",
      place: TORONTO,
    });
    render(App);

    await fireEvent.click(
      yourForm().getByRole("button", { name: "Forget Sam" }),
    );

    expect(yourForm().queryByRole("button", { name: "Use Sam" })).toBeNull();
    expect(readSavedCharts(localStorage)).toEqual([]);
  });

  it("explains a browser that blocks storage", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("Access denied", "SecurityError");
    });
    render(App);

    expect(
      yourForm().getByText("This browser isn't letting the site save charts."),
    ).toBeTruthy();
    expect(
      yourForm().getByRole<HTMLButtonElement>("button", { name: "Save" })
        .disabled,
    ).toBe(true);
  });
});

describe("App with a place entered by coordinates", () => {
  // Brampton, about 30 km from Toronto, the nearest listed place.
  const BRAMPTON = "43.6833, -79.7667";

  beforeEach(() => {
    vi.mocked(loadChartEngine).mockReset().mockResolvedValue();
    vi.mocked(createChart).mockReset().mockReturnValue(CHART);
    vi.mocked(loadPlaceIndex).mockReset().mockResolvedValue(PLACE_INDEX);
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
    vi.restoreAllMocks();
  });

  function yourForm() {
    return within(screen.getByRole("form", { name: "Your birth details" }));
  }

  async function enterCoordinates(text: string): Promise<void> {
    await fireEvent.click(
      yourForm().getByRole("button", { name: "Not listed? Enter coordinates" }),
    );
    await fireEvent.input(yourForm().getByLabelText("Coordinates"), {
      target: { value: text },
    });
  }

  it("switches to coordinates in a browser that lists UTC", async () => {
    // Some browsers include UTC in this list; Node doesn't.
    vi.spyOn(Intl, "supportedValuesOf").mockReturnValue([
      "America/Toronto",
      "UTC",
    ]);
    render(App);

    await fireEvent.click(
      yourForm().getByRole("button", { name: "Not listed? Enter coordinates" }),
    );

    expect(yourForm().getByLabelText("Coordinates")).toBeTruthy();
  });

  it("switches to coordinates after a place was chosen from the list", async () => {
    render(App);
    await choosePlace();

    await fireEvent.click(
      yourForm().getByRole("button", { name: "Not listed? Enter coordinates" }),
    );

    expect(yourForm().getByLabelText("Coordinates")).toBeTruthy();
  });

  it("switches to coordinates after drawing a chart", async () => {
    render(App);
    await fillDateTime();
    await choosePlace();
    await submit();
    await screen.findByRole("heading", { name: CHART_HEADING });

    await fireEvent.click(
      yourForm().getByRole("button", { name: "Not listed? Enter coordinates" }),
    );

    expect(yourForm().getByLabelText("Coordinates")).toBeTruthy();
  });

  it("suggests the nearest listed place's time zone", async () => {
    render(App);

    await enterCoordinates(BRAMPTON);

    await vi.waitFor(() =>
      expect(
        yourForm().getByLabelText<HTMLSelectElement>("Time zone").value,
      ).toBe("America/Toronto"),
    );
    expect(
      yourForm().getByText(/Toronto, Ontario, Canada, 30 km away/),
    ).toBeTruthy();
  });

  it("keeps suggesting as the coordinates are typed", async () => {
    render(App);

    // Partway through typing, "-7" is a valid longitude near London.
    await enterCoordinates("43.6833, -7");
    await vi.waitFor(() =>
      expect(
        yourForm().getByLabelText<HTMLSelectElement>("Time zone").value,
      ).toBe("Europe/London"),
    );
    await fireEvent.input(yourForm().getByLabelText("Coordinates"), {
      target: { value: BRAMPTON },
    });

    expect(
      yourForm().getByLabelText<HTMLSelectElement>("Time zone").value,
    ).toBe("America/Toronto");
    expect(yourForm().getByText(/Suggested from the nearest/)).toBeTruthy();
  });

  it("draws a chart for the coordinates", async () => {
    render(App);
    await fillDateTime();
    await enterCoordinates(BRAMPTON);
    await vi.waitFor(() =>
      expect(
        yourForm().getByLabelText<HTMLSelectElement>("Time zone").value,
      ).toBe("America/Toronto"),
    );

    await submit();

    expect(createChart).toHaveBeenCalledWith(
      expect.objectContaining({
        place: {
          name: "43.68° N, 79.77° W",
          region: "",
          country: "",
          latitude: 43.6833,
          longitude: -79.7667,
          timeZone: "America/Toronto",
        },
      }),
    );
  });

  it("keeps a time zone chosen by hand", async () => {
    render(App);
    await enterCoordinates(BRAMPTON);
    await fireEvent.change(yourForm().getByLabelText("Time zone"), {
      target: { value: "America/Winnipeg" },
    });

    await fireEvent.input(yourForm().getByLabelText("Coordinates"), {
      target: { value: "43.7, -79.4" },
    });

    expect(
      yourForm().getByLabelText<HTMLSelectElement>("Time zone").value,
    ).toBe("America/Winnipeg");
  });

  it("explains coordinates it can't read, and won't draw them", async () => {
    render(App);
    await fillDateTime();

    await enterCoordinates("95, 10");
    await submit();

    expect(
      yourForm().getByText("Latitude must be between -90 and 90."),
    ).toBeTruthy();
    expect(screen.getAllByRole("alert")[0].textContent).toContain(
      "Choose a place from the list, or enter its coordinates.",
    );
    expect(createChart).not.toHaveBeenCalled();
  });

  it("drops the coordinates on going back to the list", async () => {
    render(App);
    await fillDateTime();
    await enterCoordinates(BRAMPTON);

    await fireEvent.click(
      yourForm().getByRole("button", { name: "Search the list instead" }),
    );
    await submit();

    expect(yourForm().getByLabelText("Place")).toBeTruthy();
    expect(createChart).not.toHaveBeenCalled();
  });

  it("opens a share link with coordinates", async () => {
    window.history.replaceState(
      null,
      "",
      "/#date=2000-01-01&time=12:00&lat=43.7&lon=-79.4" +
        "&tz=America/Toronto&name=Smallville",
    );
    render(App);

    await vi.waitFor(() =>
      expect(createChart).toHaveBeenCalledWith(
        expect.objectContaining({
          place: expect.objectContaining({ name: "Smallville" }),
        }),
      ),
    );
    expect(
      yourForm().getByLabelText<HTMLInputElement>("Coordinates").value,
    ).toBe("43.7, -79.4");
    expect(
      yourForm().getByLabelText<HTMLInputElement>("Name (optional)").value,
    ).toBe("Smallville");
  });

  it("uses a saved chart with coordinates", async () => {
    addSavedChart(localStorage, {
      name: "Gran",
      date: "1950-03-02",
      place: {
        name: "Smallville",
        region: "",
        country: "",
        latitude: 43.7,
        longitude: -79.4,
        timeZone: "America/Toronto",
      },
    });
    render(App);

    await fireEvent.click(yourForm().getByRole("button", { name: "Use Gran" }));

    await vi.waitFor(() => expect(createChart).toHaveBeenCalled());
    expect(
      yourForm().getByLabelText<HTMLSelectElement>("Time zone").value,
    ).toBe("America/Toronto");
  });
});

describe("App with dates outside the engine's range", () => {
  beforeEach(() => {
    vi.mocked(loadChartEngine).mockReset().mockResolvedValue();
    vi.mocked(createChart).mockReset().mockReturnValue(CHART);
    vi.mocked(loadPlaceIndex).mockReset().mockResolvedValue(PLACE_INDEX);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("explains a birth date it can't calculate", async () => {
    render(App);
    await fillDateTime();
    await fireEvent.input(screen.getByLabelText("Date"), {
      target: { value: "9999-01-01" },
    });
    await choosePlace();
    await submit();

    await vi.waitFor(() =>
      expect(screen.getAllByRole("alert")[0].textContent).toMatch(
        OUT_OF_RANGE_TEXT,
      ),
    );
    expect(createChart).not.toHaveBeenCalled();
  });

  it("limits the date field to the engine's range", () => {
    render(App);

    expect(screen.getByLabelText<HTMLInputElement>("Date").max).toBe(
      "3002-12-31",
    );
  });
});

describe("App revealing the result", () => {
  beforeEach(() => {
    vi.mocked(loadChartEngine).mockReset().mockResolvedValue();
    vi.mocked(createChart).mockReset().mockReturnValue(CHART);
    vi.mocked(loadPlaceIndex).mockReset().mockResolvedValue(PLACE_INDEX);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("brings the chart into view on a narrow layout", async () => {
    stubLayout(true);
    render(App);
    await fillDateTime();
    await choosePlace();

    await submit();

    const heading = await screen.findByRole("heading", { name: CHART_HEADING });
    await vi.waitFor(() => expect(document.activeElement).toBe(heading));
    expect(wasScrolledTo(heading)).toBe(true);
  });

  it("leaves focus alone when the chart is beside the form", async () => {
    render(App);
    await fillDateTime();
    await choosePlace();

    await submit();

    const heading = await screen.findByRole("heading", { name: CHART_HEADING });
    expect(document.activeElement).not.toBe(heading);
    expect(wasScrolledTo(heading)).toBe(false);
  });

  it("keeps the form in view when its details are incomplete", async () => {
    stubLayout(true);
    render(App);

    await submit();

    expect(screen.getAllByRole("alert")[0].textContent).toContain(
      "Enter both a date and a time.",
    );
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
});
