// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExportFormat, exportWheel } from "@/lib/export";
import { drawWheel } from "@/lib/wheel";

import { CHART } from "./fixtures/chart";

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
    await exportWheel(svg, CHART, ExportFormat.Svg);

    expect(downloads).toHaveLength(1);
    expect(downloads[0].filename).toBe("aster-london-2000-01-01-1200.svg");
    expect(downloads[0].blob.type).toBe(SVG_MIME);
  });

  it("strips accents and punctuation from the filename", async () => {
    const chart = {
      ...CHART,
      details: {
        ...CHART.details,
        place: { ...CHART.details.place, name: "São Paulo (Centro)" },
      },
    };

    await exportWheel(svg, chart, ExportFormat.Svg);

    expect(downloads[0].filename).toBe(
      "aster-sao-paulo-centro-2000-01-01-1200.svg",
    );
  });

  it("writes a standalone SVG with styles inlined", async () => {
    await exportWheel(svg, CHART, ExportFormat.Svg);
    const file = await parseSvgDownload();

    expect(file.getAttribute("width")).toBe("600");
    expect(file.getAttribute("height")).toBe("600");
    expect(file.querySelectorAll("path")).toHaveLength(12);

    const axisStyle = file.querySelector(".wheel-axis")?.getAttribute("style");
    expect(axisStyle).toContain("stroke:rgb(30, 28, 26)");
    expect(axisStyle).toContain("stroke-width:2");
  });

  it("paints the page background behind the wheel", async () => {
    await exportWheel(svg, CHART, ExportFormat.Svg);
    const file = await parseSvgDownload();

    const backdrop = file.querySelector(":scope > rect");
    expect(backdrop?.getAttribute("fill")).toBe("rgb(245, 240, 232)");
    expect(backdrop?.nextElementSibling?.tagName).toBe("g");
  });

  it("leaves the on-screen wheel untouched", async () => {
    await exportWheel(svg, CHART, ExportFormat.Svg);

    expect(svg.querySelector(":scope > rect")).toBeNull();
    expect(svg.getAttribute("width")).toBeNull();
  });

  it("renders a PNG at twice the wheel's size", async () => {
    const png = new Blob(["png"], { type: "image/png" });
    const drawImage = vi.fn();
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        set src(_url: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback) => callback(png),
    );

    await exportWheel(svg, CHART, ExportFormat.Png);

    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1200, 1200);
    expect(downloads[0]).toEqual({
      blob: png,
      filename: "aster-london-2000-01-01-1200.png",
    });
  });

  it("fails loudly when the image can't be loaded", async () => {
    vi.stubGlobal(
      "Image",
      class {
        onerror: (() => void) | null = null;
        set src(_url: string) {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );

    await expect(exportWheel(svg, CHART, ExportFormat.Png)).rejects.toThrow(
      "The wheel couldn't be drawn.",
    );
    expect(downloads).toHaveLength(0);
  });

  it("releases the download URL afterwards", async () => {
    await exportWheel(svg, CHART, ExportFormat.Svg);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test/0");
  });
});
