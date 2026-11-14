// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ChartDownloads from "@/components/chart/ChartDownloads.svelte";
import ChartView from "@/components/views/ChartView.svelte";
import {
  ExportFormat,
  exportTables,
  exportWheel,
  SubjectKind,
} from "@/lib/downloads/export";

import { CHART } from "../../fixtures/chart";

vi.mock("@/lib/downloads/export", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/downloads/export")>()),
  exportWheel: vi.fn(),
  exportTables: vi.fn(),
}));

function press(name: string): Promise<boolean> {
  return fireEvent.click(screen.getByRole("button", { name }));
}

describe("ChartDownloads", () => {
  beforeEach(() => {
    vi.mocked(exportWheel).mockReset().mockResolvedValue();
    vi.mocked(exportTables).mockReset();
  });

  it.each([
    ["Download wheel as SVG", ExportFormat.Svg],
    ["Download wheel as PNG", ExportFormat.Png],
  ])("exports the drawn wheel on %s", async (name, format) => {
    render(ChartView, { chart: CHART });

    await press(name);

    const wheel = document.querySelector("svg.wheel");
    expect(exportWheel).toHaveBeenCalledWith(
      wheel,
      { kind: SubjectKind.Chart, chart: CHART },
      format,
    );
  });

  it("exports the tables as CSV", async () => {
    render(ChartView, { chart: CHART });

    await press("Download tables as CSV");

    expect(exportTables).toHaveBeenCalledWith({
      kind: SubjectKind.Chart,
      chart: CHART,
    });
  });

  it("groups the buttons by what they save", () => {
    render(ChartView, { chart: CHART });

    expect(screen.getByRole("group", { name: "Wheel" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Tables" })).toBeTruthy();
  });

  it("disables the buttons while an export runs", async () => {
    let finish!: () => void;
    vi.mocked(exportWheel).mockReturnValue(
      new Promise((resolve) => (finish = resolve)),
    );
    render(ChartView, { chart: CHART });

    await press("Download wheel as PNG");

    const csv = screen.getByRole("button", { name: "Download tables as CSV" });
    expect(csv.hasAttribute("disabled")).toBe(true);

    finish();
    await vi.waitFor(() => expect(csv.hasAttribute("disabled")).toBe(false));
  });

  it("explains a failed export", async () => {
    vi.mocked(exportWheel).mockRejectedValue(new Error("No canvas."));
    render(ChartView, { chart: CHART });

    await press("Download wheel as PNG");

    await vi.waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Couldn't export the chart: No canvas.",
      ),
    );
  });

  it("refuses to export a wheel that isn't drawn", async () => {
    render(ChartDownloads, {
      subject: { kind: SubjectKind.Chart, chart: CHART },
    });

    await press("Download wheel as SVG");

    expect(exportWheel).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "The wheel hasn't been drawn yet.",
      ),
    );
  });

  it("keeps the error hidden until something fails", () => {
    render(ChartView, { chart: CHART });

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
