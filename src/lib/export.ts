// Saves the chart wheel as a standalone SVG or PNG file, and the tables as
// CSV. The on-screen wheel takes its colours and fonts from page CSS, so
// those are resolved and written onto each element before it leaves the page.

import type { Chart } from "@/lib/chart";
import { buildChartCsv } from "@/lib/csv";
import { WHEEL_SIZE_PX } from "@/lib/wheel";

export enum ExportFormat {
  Svg = "svg",
  Png = "png",
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const SVG_MIME_TYPE = "image/svg+xml";
const PNG_MIME_TYPE = "image/png";
const CSV_MIME_TYPE = "text/csv";
const CSV_EXTENSION = "csv";

/** PNGs are drawn at twice the wheel's size so they stay sharp. */
const PNG_SCALE = 2;

const FILENAME_PREFIX = "aster";

/** Everything the wheel's stylesheet sets. */
const STYLED_PROPERTIES = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "font-family",
  "font-size",
  "font-weight",
] as const;

/**
 * Downloads the wheel drawn in `svg` as a file named after the chart.
 * Colours follow the page's current light or dark theme.
 */
export async function exportWheel(
  svg: SVGSVGElement,
  chart: Chart,
  format: ExportFormat,
): Promise<void> {
  const markup = serializeWheel(svg);
  const blob =
    format === ExportFormat.Svg
      ? new Blob([markup], { type: SVG_MIME_TYPE })
      : await renderPng(markup);

  downloadBlob(blob, buildFilename(chart, format));
}

/** Downloads the Positions and Aspects tables, side by side, as CSV. */
export function exportTables(chart: Chart): void {
  const blob = new Blob([buildChartCsv(chart)], { type: CSV_MIME_TYPE });

  downloadBlob(blob, buildFilename(chart, CSV_EXTENSION));
}

function serializeWheel(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;

  inlineStyle(svg, clone);
  const sources = svg.querySelectorAll("*");
  clone.querySelectorAll("*").forEach((element, index) => {
    inlineStyle(sources[index], element);
  });

  // A file has no page behind it, so it needs its own size and backdrop.
  // XMLSerializer adds the xmlns itself; setting it here doubles it.
  clone.setAttribute("width", String(WHEEL_SIZE_PX));
  clone.setAttribute("height", String(WHEEL_SIZE_PX));
  clone.removeAttribute("class");

  const backdrop = document.createElementNS(SVG_NAMESPACE, "rect");
  backdrop.setAttribute("width", "100%");
  backdrop.setAttribute("height", "100%");
  backdrop.setAttribute(
    "fill",
    getComputedStyle(document.body).backgroundColor,
  );
  clone.insertBefore(backdrop, clone.querySelector(":scope > g"));

  return new XMLSerializer().serializeToString(clone);
}

function inlineStyle(source: Element, target: Element): void {
  const computed = getComputedStyle(source);
  const declarations = STYLED_PROPERTIES.map((property) => [
    property,
    computed.getPropertyValue(property),
  ]).filter(([, value]) => value.length > 0);

  if (declarations.length === 0) {
    return;
  }

  target.setAttribute(
    "style",
    declarations.map(([property, value]) => `${property}:${value}`).join(";"),
  );
}

async function renderPng(markup: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([markup], { type: SVG_MIME_TYPE }));

  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = WHEEL_SIZE_PX * PNG_SCALE;
    canvas.height = WHEEL_SIZE_PX * PNG_SCALE;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("This browser can't draw images.");
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await toBlob(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The wheel couldn't be drawn."));
    image.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("The image couldn't be encoded."));
        return;
      }
      resolve(blob);
    }, PNG_MIME_TYPE);
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  // Some browsers start the download after click() returns, so the URL
  // has to outlive this task.
  setTimeout(() => URL.revokeObjectURL(url));
}

/** Example: London on 1 Jan 2000, 12:00 → "aster-london-2000-01-01-1200". */
function buildFilename(chart: Chart, extension: string): string {
  const { local, place } = chart.details;
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = `${local.year}-${pad(local.month)}-${pad(local.day)}`;
  const time = `${pad(local.hour)}${pad(local.minute)}`;

  const name = slugify(place.name);

  return `${FILENAME_PREFIX}-${name}-${date}-${time}.${extension}`;
}

/** Example: "São Paulo" → "sao-paulo". */
function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
