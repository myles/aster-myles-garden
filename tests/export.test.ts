// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ExportFormat,
  exportTables,
  exportWheel,
  SubjectKind,
} from "@/lib/export";
import { SolarReturnStyle } from "@/lib/solar-return";
import { compareCharts } from "@/lib/synastry";
import { drawBiWheel, drawWheel } from "@/lib/wheel";

import { CHART, CHART_WITHOUT_TIME, SOLAR_RETURN } from "./fixtures/chart";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const SVG_MIME = "image/svg+xml";

type Download = { blob: Blob; filename: string };

describe("exportWheel", () => {
  let svg: SVGSVGElement;
  let downloads: Download[];

  beforeEach(() => {
    vi.useFakeTimers();
    svg = document.createElementNS(SVG_NAMESPACE, "svg");
    document.body.append(svg);
    drawWheel(svg, CHART);

    // Stand-in for the page stylesheet.
    document.body.style.backgroundColor = "rgb(245, 240, 232)";
    svg.querySelectorAll(".wheel-axis").forEach((axis) => {
      axis.setAttribute("style", "stroke: rgb(30, 28, 26); stroke-width: 2");
    });

    downloads = [];
    const blobs = new Map<string, Blob>();
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      const url = `blob:test/${blobs.size}`;
      blobs.set(url, blob as Blob);
      return url;
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push({ blob: blobs.get(this.href)!, filename: this.download });
    });
  });

  afterEach(() => {
    svg.remove();
    document.body.removeAttribute("style");
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function parseSvgDownload(): Promise<SVGSVGElement> {
    const markup = await downloads[0].blob.text();
    const file = new DOMParser().parseFromString(markup, SVG_MIME);
    return file.documentElement as unknown as SVGSVGElement;
  }

  it("names the file after the place and birth moment", async () => {
    await exportWheel(
      svg,
      { kind: SubjectKind.Chart, chart: CHART },
      ExportFormat.Svg,
    );

    expect(downloads).toHaveLength(1);
    expect(downloads[0].filename).toBe("aster-london-2000-01-01-1200.svg");
    expect(downloads[0].blob.type).toBe(SVG_MIME);
  });

  it("leaves the time out of the filename when it's unknown", async () => {
    await exportWheel(
      svg,
      { kind: SubjectKind.Chart, chart: CHART_WITHOUT_TIME },
      ExportFormat.Svg,
    );

    expect(downloads[0].filename).toBe("aster-london-2000-01-01.svg");
  });

  it("strips accents and punctuation from the filename", async () => {
    const chart = {
      ...CHART,
      details: {
        ...CHART.details,
        place: { ...CHART.details.place, name: "São Paulo (Centro)" },
      },
    };

    await exportWheel(
      svg,
      { kind: SubjectKind.Chart, chart: chart },
      ExportFormat.Svg,
    );

    expect(downloads[0].filename).toBe(
      "aster-sao-paulo-centro-2000-01-01-1200.svg",
    );
  });

  it("names a place with no Latin letters by its coordinates", async () => {
    const chart = {
      ...CHART,
      details: {
        ...CHART.details,
        place: { ...CHART.details.place, name: "東京" },
      },
    };

    await exportWheel(
      svg,
      { kind: SubjectKind.Chart, chart: chart },
      ExportFormat.Svg,
    );

    expect(downloads[0].filename).toBe(
      "aster-51-50-n-0-12-w-2000-01-01-1200.svg",
    );
  });

  it("writes a standalone SVG with styles inlined", async () => {
    await exportWheel(
      svg,
      { kind: SubjectKind.Chart, chart: CHART },
      ExportFormat.Svg,
    );
    const file = await parseSvgDownload();

    expect(file.getAttribute("width")).toBe("600");
    expect(file.getAttribute("height")).toBe("600");
    expect(file.querySelectorAll("path")).toHaveLength(12);
    expect(file.querySelector("desc")?.textContent).toContain("ascendant");

    const axisStyle = file.querySelector(".wheel-axis")?.getAttribute("style");
    expect(axisStyle).toContain("stroke:rgb(30, 28, 26)");
    expect(axisStyle).toContain("stroke-width:2");
  });

  it("paints the page background behind the wheel", async () => {
    await exportWheel(
      svg,
      { kind: SubjectKind.Chart, chart: CHART },
      ExportFormat.Svg,
    );
    const file = await parseSvgDownload();

    const backdrop = file.querySelector(":scope > rect");
    expect(backdrop?.getAttribute("fill")).toBe("rgb(245, 240, 232)");
    expect(backdrop?.nextElementSibling?.tagName).toBe("g");
  });

  it("leaves the on-screen wheel untouched", async () => {
    await exportWheel(
      svg,
      { kind: SubjectKind.Chart, chart: CHART },
      ExportFormat.Svg,
    );

    expect(svg.querySelector(":scope > rect")).toBeNull();
    expect(svg.getAttribute("width")).toBeNull();
  });

  it("renders a PNG at twice the wheel's size", async () => {
    const png = new Blob(["png"], { type: "image/png" });
    const drawImage = vi.fn();
    vi.stubGlobal(
      "Image",
      class extends EventTarget {
        set src(_url: string) {
          queueMicrotask(() => this.dispatchEvent(new Event("load")));
        }
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback) => callback(png),
    );

    await exportWheel(
      svg,
      { kind: SubjectKind.Chart, chart: CHART },
      ExportFormat.Png,
    );

    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1200, 1200);
    expect(downloads[0]).toEqual({
      blob: png,
      filename: "aster-london-2000-01-01-1200.png",
    });
  });

  it("fails loudly when the image can't be loaded", async () => {
    vi.stubGlobal(
      "Image",
      class extends EventTarget {
        set src(_url: string) {
          queueMicrotask(() => this.dispatchEvent(new Event("error")));
        }
      },
    );

    await expect(
      exportWheel(
        svg,
        { kind: SubjectKind.Chart, chart: CHART },
        ExportFormat.Png,
      ),
    ).rejects.toThrow("The wheel couldn't be drawn.");
    expect(downloads).toHaveLength(0);
  });

  it("releases the download URL afterwards", async () => {
    await exportWheel(
      svg,
      { kind: SubjectKind.Chart, chart: CHART },
      ExportFormat.Svg,
    );
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test/0");
  });

  it("downloads the tables as CSV", async () => {
    exportTables({ kind: SubjectKind.Chart, chart: CHART });

    expect(downloads[0].filename).toBe("aster-london-2000-01-01-1200.csv");
    expect(downloads[0].blob.type).toBe("text/csv");
    expect(await downloads[0].blob.text()).toContain(
      "Body,Position,House,,Pair,Aspect,Orb",
    );
  });

  it("names a comparison after both charts", async () => {
    const synastry = compareCharts(CHART, CHART_WITHOUT_TIME);

    await exportWheel(
      svg,
      { kind: SubjectKind.Comparison, synastry },
      ExportFormat.Svg,
    );

    expect(downloads[0].filename).toBe(
      "aster-london-2000-01-01-1200-and-london-2000-01-01.svg",
    );
  });

  it("downloads a comparison's tables as CSV", async () => {
    exportTables({
      kind: SubjectKind.Comparison,
      synastry: compareCharts(CHART, CHART),
    });

    expect(downloads[0].filename).toBe(
      "aster-london-2000-01-01-1200-and-london-2000-01-01-1200.csv",
    );
    expect(await downloads[0].blob.text()).toContain("Aspects between you");
  });

  it("names a solar return after the natal chart and its year", async () => {
    const solarReturn = { natal: CHART, year: 2026, chart: CHART };

    exportTables({ kind: SubjectKind.SolarReturn, solarReturn });

    expect(downloads[0].filename).toBe(
      "aster-london-2000-01-01-1200-solar-return-2026.csv",
    );
    expect(await downloads[0].blob.text()).toContain("Positions");
  });

  it("downloads a composite's tables, named after both charts", async () => {
    const composite = {
      first: CHART,
      second: CHART,
      bodies: CHART.bodies,
      houses: CHART.houses,
      aspects: CHART.aspects,
    };

    exportTables({ kind: SubjectKind.Composite, composite });

    expect(downloads[0].filename).toBe(
      "aster-london-2000-01-01-1200-and-london-2000-01-01-1200-composite.csv",
    );
    expect(await downloads[0].blob.text()).toContain("Composite positions");
  });

  it("sizes a bi-wheel's file and backdrop to its wider view", async () => {
    drawBiWheel(svg, {
      inner: CHART,
      outerBodies: CHART.bodies,
      aspects: [],
      title: "Chart comparison wheel",
      innerLabel: "Your",
      outerLabel: "Their",
    });

    await exportWheel(
      svg,
      { kind: SubjectKind.Chart, chart: CHART },
      ExportFormat.Svg,
    );
    const file = await parseSvgDownload();

    expect(file.getAttribute("width")).toBe("780");
    const backdrop = file.querySelector(":scope > rect");
    expect(backdrop?.getAttribute("x")).toBe("-90");
    expect(backdrop?.getAttribute("width")).toBe("780");
  });

  it("names and exports the solar return comparison tables", async () => {
    exportTables({
      kind: SubjectKind.SolarReturn,
      solarReturn: SOLAR_RETURN,
      style: SolarReturnStyle.BiWheel,
    });
    expect(downloads[0].filename).toBe(
      "aster-london-2000-01-01-1200-solar-return-2026-bi-wheel.csv",
    );
    expect(await downloads[0].blob.text()).toContain("Natal house");
  });

  it("names transits after the chart and the moment, in UTC", async () => {
    const transits = {
      natal: CHART,
      at: new Date("2026-11-13T20:05:00Z"),
      bodies: CHART.bodies,
      aspects: [],
    };

    exportTables({ kind: SubjectKind.Transits, transits });

    expect(downloads[0].filename).toBe(
      "aster-london-2000-01-01-1200-transits-2026-11-13-2005-utc.csv",
    );
    expect(await downloads[0].blob.text()).toContain("Transits to your chart");
  });
});
