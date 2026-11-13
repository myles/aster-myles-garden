// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import ChartWheel from "@/components/ChartWheel.svelte";
import { describeBiWheel, describeWheel } from "@/lib/describe";

import { CHART } from "./fixtures/chart";

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
});
