// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import ChartWheel from "@/components/chart/ChartWheel.svelte";
import { describeBiWheel, describeWheel } from "@/lib/wheel/describe";

import { CHART } from "../../fixtures/chart";

function readDescription(): string[] {
  const panel = screen.getByText("Describe the wheel").closest("details")!;
  return within(panel)
    .getAllByRole("listitem", { hidden: true })
    .map((item) => item.textContent ?? "");
}

describe("ChartWheel", () => {
  it("offers the wheel's description in words", async () => {
    render(ChartWheel, { chart: CHART });

    await fireEvent.click(screen.getByText("Describe the wheel"));

    expect(readDescription()).toEqual(describeWheel(CHART));
  });

  it("describes a bi-wheel's two rings", () => {
    const biWheel = {
      inner: CHART,
      outerBodies: CHART.bodies,
      aspects: [],
      title: "Chart comparison wheel",
      innerLabel: "Your",
      outerLabel: "Their",
    };
    render(ChartWheel, { chart: CHART, biWheel });

    expect(readDescription()).toEqual(describeBiWheel(biWheel));
  });

  it("names the wheel and points to its description", () => {
    render(ChartWheel, { chart: CHART });

    const wheel = screen.getByRole("img", { name: "Natal chart wheel" });
    expect(wheel.getAttribute("aria-describedby")).toBe("wheel-description");
  });

  it("fits the wheel to the screen until it's enlarged", () => {
    render(ChartWheel, { chart: CHART });

    const toggle = screen.getByRole("button", { name: "Enlarge wheel" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("region", { name: "Enlarged wheel" })).toBeNull();
  });

  it("enlarges the wheel in a scrollable region", async () => {
    render(ChartWheel, { chart: CHART });
    const toggle = screen.getByRole("button", { name: "Enlarge wheel" });

    await fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    const region = screen.getByRole("region", { name: "Enlarged wheel" });
    // Focusable, so the keyboard can scroll it.
    expect(region.tabIndex).toBe(0);
    const wheel = within(region).getByRole("img", {
      name: "Natal chart wheel",
    });
    expect(wheel.parentElement!.classList).toContain("w-[56rem]");
  });

  it("fits the wheel back to the screen", async () => {
    render(ChartWheel, { chart: CHART });
    const toggle = screen.getByRole("button", { name: "Enlarge wheel" });

    await fireEvent.click(toggle);
    await fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("region", { name: "Enlarged wheel" })).toBeNull();
  });
});
