// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SolarReturnView from "@/components/SolarReturnView.svelte";
import { HouseSystem } from "@/lib/houses";
import { SolarReturnStyle } from "@/lib/solar-return";

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

  it("switches to natal comparison and back", async () => {
    render(SolarReturnView, { solarReturn: SOLAR_RETURN });

    await fireEvent.click(
      screen.getByRole("radio", {
        name: "Against natal chart",
      }),
    );

    const wheel = screen.getByRole("img", {
      name: "Solar return comparison wheel",
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
      screen.getByRole("img", { name: "Solar return chart wheel" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("columnheader", { name: "Natal house" }),
    ).toBeNull();
  });

  it("updates the comparison when the return changes", async () => {
    const { rerender } = render(SolarReturnView, {
      solarReturn: SOLAR_RETURN,
      style: SolarReturnStyle.BiWheel,
    });
    const wheel = screen.getByRole("img", {
      name: "Solar return comparison wheel",
    });
    const before = wheel.innerHTML;

    await rerender({
      solarReturn: {
        ...SOLAR_RETURN,
        year: 2027,
        chart: {
          ...CHART,
          bodies: [{ ...CHART.bodies[0], longitude: 190 }],
        },
      },
    });

    expect(wheel.innerHTML).not.toBe(before);
    expect(wheel.querySelectorAll(".wheel-body--outer")).toHaveLength(1);
    expect(screen.getByText(/Natal Mars – .*Return Sun/)).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Solar return 2027" }),
    ).toBeTruthy();
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
