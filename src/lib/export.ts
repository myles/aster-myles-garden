// Saves the chart wheel as a standalone SVG or PNG file, and the tables as
// CSV. The on-screen wheel takes its colours and fonts from page CSS, so
// those are resolved and written onto each element before it leaves the page.

import type { Chart } from "@/lib/chart";
import type { Synastry } from "@/lib/synastry";
import type { Transits } from "@/lib/transits";

import { buildChartCsv, buildComparisonCsv, buildTransitsCsv } from "@/lib/csv";

export enum ExportFormat {
  Svg = "svg",
  Png = "png",
}

export enum SubjectKind {
  Chart = "chart",
  Comparison = "comparison",
  Transits = "transits",
}

/** What's being exported, which decides the CSV and the file name. */
export type ExportSubject =
  | { kind: SubjectKind.Chart; chart: Chart }
  | { kind: SubjectKind.Comparison; synastry: Synastry }
  | { kind: SubjectKind.Transits; transits: Transits };

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
  "stroke-dasharray",
  "font-family",
  "font-size",
  "font-weight",
] as const;

/**
 * Downloads the wheel drawn in `svg` as a file named after what it shows.
 * Colours follow the page's current light or dark theme.
 */
export async function exportWheel(
  svg: SVGSVGElement,
  subject: ExportSubject,
  format: ExportFormat,
): Promise<void> {
  const { markup, sizePx } = serializeWheel(svg);
  const blob =
    format === ExportFormat.Svg
      ? new Blob([markup], { type: SVG_MIME_TYPE })
      : await renderPng(markup, sizePx);

  downloadBlob(blob, buildFilename(subject, format));
}

/** Downloads the subject's tables, side by side, as CSV. */
export function exportTables(subject: ExportSubject): void {
  const blob = new Blob([buildCsv(subject)], { type: CSV_MIME_TYPE });

  downloadBlob(blob, buildFilename(subject, CSV_EXTENSION));
}

function buildCsv(subject: ExportSubject): string {
  switch (subject.kind) {
    case SubjectKind.Chart:
      return buildChartCsv(subject.chart);
    case SubjectKind.Comparison:
      return buildComparisonCsv(subject.synastry);
    case SubjectKind.Transits:
      return buildTransitsCsv(subject.transits);
  }
}

function serializeWheel(svg: SVGSVGElement): {
  markup: string;
  sizePx: number;
} {
  const viewBox = readViewBox(svg);
  const clone = svg.cloneNode(true) as SVGSVGElement;

  inlineStyle(svg, clone);
  const sources = svg.querySelectorAll("*");
  clone.querySelectorAll("*").forEach((element, index) => {
    inlineStyle(sources[index], element);
  });

  // A file has no page behind it, so it needs its own size and backdrop.
  // XMLSerializer adds the xmlns itself; setting it here doubles it.
  clone.setAttribute("width", String(viewBox.sizePx));
  clone.setAttribute("height", String(viewBox.sizePx));
  clone.removeAttribute("class");

  // Cover the whole view box, which starts above and left of the origin
  // on a bi-wheel.
  const backdrop = document.createElementNS(SVG_NAMESPACE, "rect");
  backdrop.setAttribute("x", String(viewBox.x));
  backdrop.setAttribute("y", String(viewBox.y));
  backdrop.setAttribute("width", String(viewBox.sizePx));
  backdrop.setAttribute("height", String(viewBox.sizePx));
  backdrop.setAttribute(
    "fill",
    getComputedStyle(document.body).backgroundColor,
  );
  clone.insertBefore(backdrop, clone.querySelector(":scope > g"));

  return {
    markup: new XMLSerializer().serializeToString(clone),
    sizePx: viewBox.sizePx,
  };
}

/** The wheel's square view box. Example: "-90 -90 780 780". */
function readViewBox(svg: SVGSVGElement): {
  x: number;
  y: number;
  sizePx: number;
} {
  const [x, y, sizePx] = (svg.getAttribute("viewBox") ?? "")
    .split(" ")
    .map(Number);

  if ([x, y, sizePx].some((value) => !Number.isFinite(value))) {
    throw new Error("The wheel hasn't been drawn yet.");
  }

  return { x, y, sizePx };
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

async function renderPng(markup: string, sizePx: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([markup], { type: SVG_MIME_TYPE }));

  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = sizePx * PNG_SCALE;
    canvas.height = sizePx * PNG_SCALE;

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

/**
 * Examples, for a chart born in London on 1 Jan 2000 at 12:00:
 * - the chart → "aster-london-2000-01-01-1200"
 * - compared → "aster-london-2000-01-01-1200-and-toronto-1990-05-15"
 * - transits → "aster-london-2000-01-01-1200-transits-2026-11-13-2000-utc"
 */
function buildFilename(subject: ExportSubject, extension: string): string {
  return `${FILENAME_PREFIX}-${describeSubject(subject)}.${extension}`;
}

function describeSubject(subject: ExportSubject): string {
  switch (subject.kind) {
    case SubjectKind.Chart:
      return describeChart(subject.chart);
    case SubjectKind.Comparison:
      return [subject.synastry.first, subject.synastry.second]
        .map(describeChart)
        .join("-and-");
    case SubjectKind.Transits:
      return (
        `${describeChart(subject.transits.natal)}-transits-` +
        describeInstant(subject.transits.at)
      );
  }
}

/** In UTC, so the name doesn't depend on where it was saved. */
function describeInstant(at: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const date =
    `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-` +
    pad(at.getUTCDate());

  return `${date}-${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}-utc`;
}

/**
 * Example: London on 1 Jan 2000, 12:00 → "london-2000-01-01-1200". A chart
 * without a birth time leaves its time part off.
 */
function describeChart(chart: Chart): string {
  const { date, time, place } = chart.details;
  const pad = (value: number) => String(value).padStart(2, "0");
  const parts = [
    slugify(place.name),
    `${date.year}-${pad(date.month)}-${pad(date.day)}`,
  ];

  if (time) {
    parts.push(`${pad(time.hour)}${pad(time.minute)}`);
  }

  return parts.join("-");
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
