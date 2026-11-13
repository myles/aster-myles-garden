// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ChartWheel from "@/components/ChartWheel.svelte";
import { ExportFormat, exportWheel } from "@/lib/export";

import { CHART } from "./fixtures/chart";

vi.mock("@/lib/export", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/export")>()),
  exportWheel: vi.fn(),
}));

describe("ChartWheel", () => {
  beforeEach(() => {
    vi.mocked(exportWheel).mockReset().mockResolvedValue();
  });

  it.each([
    ["Download SVG", ExportFormat.Svg],
    ["Download PNG", ExportFormat.Png],
  ])("exports when %s is pressed", async (name, format) => {
    render(ChartWheel, { chart: CHART });

    await fireEvent.click(screen.getByRole("button", { name }));

    expect(exportWheel).toHaveBeenCalledWith(
      expect.any(SVGSVGElement),
      CHART,
      format,
    );
  });

  it("explains a failed export", async () => {
    vi.mocked(exportWheel).mockRejectedValue(new Error("No canvas."));
    render(ChartWheel, { chart: CHART });

    await fireEvent.click(screen.getByRole("button", { name: "Download PNG" }));

    await vi.waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Couldn't export the chart: No canvas.",
      ),
    );
  });

  it("keeps the error hidden until something fails", () => {
    render(ChartWheel, { chart: CHART });

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
