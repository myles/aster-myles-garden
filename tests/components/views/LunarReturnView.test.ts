// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LunarReturnView from "@/components/views/LunarReturnView.svelte";
import { Body } from "@/lib/astrology/bodies";
import { HouseSystem } from "@/lib/astrology/houses";
import { ReturnStyle } from "@/lib/charts/returns";

import { CHART, LUNAR_RETURN, POLAR_CHART } from "../../fixtures/chart";

describe("LunarReturnView", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("draws the return's wheel, positions and aspects", () => {
    render(LunarReturnView, { lunarReturn: LUNAR_RETURN });

    expect(
      screen.getByRole("heading", { name: "Lunar return, 3 December 2026" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "Lunar return chart wheel" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Positions" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Aspects" })).toBeTruthy();
  });

  it("switches to natal comparison and back", async () => {
    render(LunarReturnView, { lunarReturn: LUNAR_RETURN });

    await fireEvent.click(
      screen.getByRole("radio", { name: "Against natal chart" }),
    );

    const wheel = screen.getByRole("img", {
      name: "Lunar return comparison wheel",
    });
    expect(wheel.querySelectorAll(".wheel-body--outer")).toHaveLength(2);
    expect(
      screen.getByRole("columnheader", { name: "Natal house" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Aspects to natal chart" }),
    ).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("returnStyle=biWheel"),
    );

    await fireEvent.click(screen.getByRole("radio", { name: "Return alone" }));
    expect(
      screen.getByRole("img", { name: "Lunar return chart wheel" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("columnheader", { name: "Natal house" }),
    ).toBeNull();
  });

  it("says where the Moon returns to", () => {
    const natal = {
      ...CHART,
      bodies: [
        ...CHART.bodies,
        {
          body: Body.Moon,
          longitude: 45.5,
          latitude: 0,
          speed: 13,
          house: 2,
          isRetrograde: false,
        },
      ],
    };

    render(LunarReturnView, { lunarReturn: { ...LUNAR_RETURN, natal } });

    expect(screen.getByText(/The Moon returns to 15° 30′ Taurus/)).toBeTruthy();
  });

  it("says when its houses fell back near the pole", () => {
    const chart = {
      ...LUNAR_RETURN.chart,
      details: {
        ...LUNAR_RETURN.chart.details,
        houseSystem: HouseSystem.Placidus,
      },
      houses: { ...CHART.houses!, houseSystem: HouseSystem.Porphyry },
    };

    render(LunarReturnView, { lunarReturn: { ...LUNAR_RETURN, chart } });

    expect(screen.getByText(/so the return uses Porphyry/)).toBeTruthy();
  });

  it("names the natal houses the bi-wheel draws", () => {
    render(LunarReturnView, {
      lunarReturn: { ...LUNAR_RETURN, natal: POLAR_CHART },
      style: ReturnStyle.BiWheel,
    });

    expect(screen.getByText(/· Porphyry$/)).toBeTruthy();
    expect(screen.getByText(/so your natal chart uses Porphyry/)).toBeTruthy();
  });

  it("shares a link that reopens the return by its date", async () => {
    render(LunarReturnView, { lunarReturn: LUNAR_RETURN });

    await fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringMatching(/&lunarReturn=2026-12-03$/),
    );
  });
});
