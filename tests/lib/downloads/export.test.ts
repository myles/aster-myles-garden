// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Ayanamsa } from "@/lib/astrology/ayanamsa";
import { ReturnStyle } from "@/lib/charts/returns";
import { compareCharts } from "@/lib/charts/synastry";
import {
  ExportFormat,
  exportTables,
  exportWheel,
  findPageTheme,
  SubjectKind,
  WheelTheme,
} from "@/lib/downloads/export";
import { drawBiWheel, drawWheel } from "@/lib/wheel/wheel";

import {
  CHART,
  CHART_WITHOUT_TIME,
  LUNAR_RETURN,
  PROGRESSIONS,
  SOLAR_RETURN,
} from "../../fixtures/chart";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const SVG_MIME = "image/svg+xml";

type Download = { blob: Blob; filename: string };

describe("exportWheel", () => {
  let svg: SVGSVGElement;
  let downloads: Download[];
  let style: HTMLStyleElement;

  beforeEach(() => {
    vi.useFakeTimers();
    svg = document.createElementNS(SVG_NAMESPACE, "svg");
    document.body.append(svg);
    drawWheel(svg, CHART);

    // Stand-in for the page stylesheet, with a light and a dark theme.
    style = document.createElement("style");
    style.textContent = `
      .wheel-backdrop { fill: rgb(245, 240, 232); }
      .wheel-axis { stroke: rgb(30, 28, 26); stroke-width: 2; }
      .wheel-theme-dark .wheel-backdrop { fill: rgb(28, 26, 24); }
      .wheel-theme-dark .wheel-axis { stroke: rgb(245, 240, 232); }
    `;
    document.head.append(style);

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
    style.remove();
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

  it("paints the theme's background behind the wheel", async () => {
    await exportWheel(
      svg,
      { kind: SubjectKind.Chart, chart: CHART },
      ExportFormat.Svg,
      WheelTheme.Light,
    );
    const file = await parseSvgDownload();

    const backdrop = file.querySelector(":scope > rect");
    expect(backdrop?.getAttribute("fill")).toBe("rgb(245, 240, 232)");
    expect(backdrop?.getAttribute("class")).toBeNull();
    expect(backdrop?.nextElementSibling?.tagName).toBe("g");
  });

  it("draws a dark wheel whatever the page shows", async () => {
    await exportWheel(
      svg,
      { kind: SubjectKind.Chart, chart: CHART },
      ExportFormat.Svg,
      WheelTheme.Dark,
    );
    const file = await parseSvgDownload();

    expect(file.querySelector(":scope > rect")?.getAttribute("fill")).toBe(
      "rgb(28, 26, 24)",
    );
    expect(file.querySelector(".wheel-axis")?.getAttribute("style")).toContain(
      "stroke:rgb(245, 240, 232)",
    );
    // The class only lends the colours; the file doesn't keep it.
    expect(file.classList.contains("wheel-theme-dark")).toBe(false);
  });

  it("takes the page's theme by default", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-color-scheme: dark)",
    }));

    expect(findPageTheme()).toBe(WheelTheme.Dark);
    await exportWheel(
      svg,
      { kind: SubjectKind.Chart, chart: CHART },
      ExportFormat.Svg,
    );
    const file = await parseSvgDownload();

    expect(file.querySelector(":scope > rect")?.getAttribute("fill")).toBe(
      "rgb(28, 26, 24)",
    );
  });

  it("reads as light where the browser can't say", () => {
    vi.stubGlobal("matchMedia", undefined);

    expect(findPageTheme()).toBe(WheelTheme.Light);
  });

  it("leaves the on-screen wheel untouched", async () => {
    await exportWheel(
      svg,
      { kind: SubjectKind.Chart, chart: CHART },
      ExportFormat.Svg,
    );

    expect(svg.querySelector(":scope > rect")).toBeNull();
    expect(svg.getAttribute("width")).toBeNull();
    expect(svg.getAttribute("class")).toBe("wheel");
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
      style: ReturnStyle.BiWheel,
    });
    expect(downloads[0].filename).toBe(
      "aster-london-2000-01-01-1200-solar-return-2026-bi-wheel.csv",
    );
    expect(await downloads[0].blob.text()).toContain("Natal house");
  });

  it("names a sidereal chart's files after its zodiac", async () => {
    const chart = {
      ...CHART,
      details: { ...CHART.details, ayanamsa: Ayanamsa.FaganBradley },
    };

    exportTables({ kind: SubjectKind.Chart, chart });

    expect(downloads[0].filename).toBe(
      "aster-london-2000-01-01-1200-sidereal-fagan-bradley.csv",
    );
  });

  it("names a lunar return after the natal chart and its date", async () => {
    const chart = {
      ...CHART,
      details: { ...CHART.details, date: { year: 2026, month: 12, day: 3 } },
    };

    exportTables({
      kind: SubjectKind.LunarReturn,
      lunarReturn: { natal: CHART, chart },
    });

    expect(downloads[0].filename).toBe(
      "aster-london-2000-01-01-1200-lunar-return-2026-12-03.csv",
    );
    expect(await downloads[0].blob.text()).toContain("Positions");
  });

  it("names and exports the lunar return comparison tables", async () => {
    exportTables({
      kind: SubjectKind.LunarReturn,
      lunarReturn: LUNAR_RETURN,
      style: ReturnStyle.BiWheel,
    });

    expect(downloads[0].filename).toBe(
      "aster-london-2000-01-01-1200-lunar-return-2026-12-03-bi-wheel.csv",
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

  it("names progressions after the chart and the date", async () => {
    exportTables({
      kind: SubjectKind.Progressions,
      progressions: PROGRESSIONS,
    });

    expect(downloads[0].filename).toBe(
      "aster-london-2000-01-01-1200-progressed-2026-11-14.csv",
    );
    expect(await downloads[0].blob.text()).toContain(
      "Progressions to your chart",
    );
  });
});
