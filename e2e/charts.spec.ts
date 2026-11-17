import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { placeOptions } from "./places";

const PLACE_FIXTURE_PATH = fileURLToPath(
  new URL("./fixtures/places.json", import.meta.url),
);

async function fillBirthDetails(form: Locator, place: string): Promise<void> {
  await form.getByLabel("Date", { exact: true }).fill("2000-01-01");
  await form.getByLabel("Time", { exact: true }).fill("12:00");
  await form.getByRole("combobox", { name: "Place" }).fill(place);
  await placeOptions(form).first().click();
}

async function drawChart(page: Page): Promise<void> {
  const form = page.getByRole("form", { name: "Your birth details" });
  await expect(form.getByLabel("Date", { exact: true })).toBeEnabled();
  await fillBirthDetails(form, "London");
  await form.getByRole("button", { name: "Draw chart" }).click();
  await expect(
    page.getByRole("img", { name: "Natal chart wheel" }),
  ).toBeVisible();
}

async function compareCharts(page: Page): Promise<void> {
  await drawChart(page);
  await page.getByRole("button", { name: "Compare with someone else" }).click();
  const form = page.getByRole("form", { name: "Their birth details" });
  await fillBirthDetails(form, "Toronto");
  await form.getByRole("button", { name: "Compare charts" }).click();
  await expect(
    page.getByRole("heading", { name: "Chart comparison" }),
  ).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.route("**/data/places.json", (route) =>
    route.fulfill({
      path: PLACE_FIXTURE_PATH,
      contentType: "application/json",
    }),
  );
  await page.goto("/");
});

test("draws a chart using the real calculation engine", async ({ page }) => {
  await drawChart(page);
  await expect(page.getByRole("heading", { name: "Positions" })).toBeVisible();
  await expect(page).toHaveURL("/");
});

for (const format of ["SVG", "PNG"]) {
  test(`keeps angle labels clear and exports ${format}`, async ({
    page,
  }, testInfo) => {
    await drawChart(page);
    await page.evaluate(() => document.fonts.ready);

    const wheel = page.getByRole("img", { name: "Natal chart wheel" });
    const collisions = await wheel.evaluate((svg) => {
      const labels = svg.querySelectorAll(".wheel-axis-label");
      const annotations = svg.querySelectorAll(
        ".wheel-body-degree, .wheel-body-retrograde",
      );
      const overlaps: string[] = [];

      for (const label of labels) {
        const axis = label.getBoundingClientRect();

        for (const annotation of annotations) {
          const body = annotation.getBoundingClientRect();
          if (
            axis.left < body.right &&
            axis.right > body.left &&
            axis.top < body.bottom &&
            axis.bottom > body.top
          ) {
            overlaps.push(`${label.textContent}: ${annotation.textContent}`);
          }
        }
      }

      return overlaps;
    });
    expect(collisions).toEqual([]);
    await expect(wheel).toHaveScreenshot("natal-wheel.png");

    const pendingDownload = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: `Download wheel as ${format}`,
      })
      .click();
    const download = await pendingDownload;

    expect(await download.failure()).toBeNull();
    expect(download.suggestedFilename()).toMatch(
      new RegExp(`\\.${format.toLowerCase()}$`),
    );
    await download.saveAs(
      testInfo.outputPath(`export.${format.toLowerCase()}`),
    );
  });
}

test("compares two charts and returns to the natal chart", async ({ page }) => {
  await compareCharts(page);
  await expect(
    page.getByRole("img", { name: "Chart comparison wheel" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop comparing" }).click();
  await expect(
    page.getByRole("img", { name: "Natal chart wheel" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Chart comparison" }),
  ).toHaveCount(0);
});

test("draws the composite of two charts", async ({ page }) => {
  await compareCharts(page);
  await page.getByRole("radio", { name: "Composite" }).check();

  await expect(
    page.getByRole("img", { name: "Composite chart wheel" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Composite positions" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("finds a solar return and casts it elsewhere", async ({ page }) => {
  await drawChart(page);
  await page.getByRole("button", { name: "See solar return" }).click();
  await expect(
    page.getByRole("img", { name: "Solar return chart wheel" }),
  ).toBeVisible();

  const form = page.getByRole("form", { name: "Solar return" });
  await form.getByLabel("Year").fill("2030");
  await form.getByRole("combobox", { name: "Place" }).fill("Toronto");
  await placeOptions(form).first().click();
  await form.getByRole("button", { name: "Show solar return" }).click();

  await expect(
    page.getByRole("heading", { name: "Solar return 2030" }),
  ).toBeVisible();
  await expect(page.getByText(/Toronto, Ontario, Canada ·/)).toBeVisible();
  await expect(form.getByRole("alert")).toHaveCount(0);
});

test("finds a lunar return and sets it against the natal chart", async ({
  page,
}) => {
  await drawChart(page);
  await page.getByRole("button", { name: "See lunar return" }).click();
  await expect(
    page.getByRole("img", { name: "Lunar return chart wheel" }),
  ).toBeVisible();

  const form = page.getByRole("form", { name: "Lunar return" });
  await form.getByLabel("Date").fill("2030-06-15");
  await form.getByRole("combobox", { name: "Place" }).fill("Toronto");
  await placeOptions(form).first().click();
  await form.getByRole("button", { name: "Show lunar return" }).click();

  // The return in effect on 15 June comes within the four weeks before.
  await expect(
    page.getByRole("heading", { name: /^Lunar return, \d+ (May|June) 2030$/ }),
  ).toBeVisible();
  await expect(page.getByText(/Toronto, Ontario, Canada ·/)).toBeVisible();
  await expect(form.getByRole("alert")).toHaveCount(0);

  await page.getByRole("radio", { name: "Against natal chart" }).check();
  const wheel = page.getByRole("img", {
    name: "Lunar return comparison wheel",
  });
  await expect(wheel.locator(".wheel-body--outer")).toHaveCount(13);
});

test("shows progressions for a date", async ({ page }) => {
  await drawChart(page);
  await page.getByRole("button", { name: "See progressions" }).click();

  const form = page.getByRole("form", { name: "Progressed date" });
  await form.getByLabel("Date").fill("2030-01-01");
  await form.getByRole("button", { name: "Show progressions" }).click();

  await expect(page.getByText(/Progressed to 1 January 2030/)).toBeVisible();
  await expect(form.getByRole("alert")).toHaveCount(0);
  const wheel = page.getByRole("img", { name: "Progressed wheel" });
  await expect(wheel.locator(".wheel-body--outer")).toHaveCount(13);
  await expect(wheel).toHaveScreenshot("progressed-bi-wheel.png");
});

test("preserves both charts when comparison details are incomplete", async ({
  page,
}) => {
  await compareCharts(page);
  const wheel = page.getByRole("img", { name: "Chart comparison wheel" });
  const originalWheel = await wheel.innerHTML();
  const form = page.getByRole("form", { name: "Their birth details" });
  await form.getByRole("combobox", { name: "Place" }).fill("");
  await page.getByLabel("House system", { exact: true }).selectOption("koch");
  await expect(form.getByRole("alert")).toContainText("Choose a place");
  await expect(wheel).toHaveJSProperty("innerHTML", originalWheel);
  await expect(
    page.getByText("Placidus houses.", { exact: false }),
  ).toBeVisible();

  await fillBirthDetails(form, "Toronto");
  await form.getByRole("button", { name: "Compare charts" }).click();
  await expect(form.getByRole("alert")).toBeHidden();
  await expect(page.getByText("Koch houses.", { exact: false })).toBeVisible();
});

for (const format of ["SVG", "PNG"]) {
  test(`compares a solar return and exports ${format}`, async ({
    page,
  }, testInfo) => {
    await drawChart(page);
    await page.getByRole("button", { name: "See solar return" }).click();
    await page.getByRole("radio", { name: "Against natal chart" }).check();
    const form = page.getByRole("form", { name: "Solar return" });
    await form.getByLabel("Year").fill("2030");
    await form.getByRole("button", { name: "Show solar return" }).click();
    await expect(
      page.getByRole("radio", {
        name: "Against natal chart",
      }),
    ).toBeChecked();

    const wheel = page.getByRole("img", {
      name: "Solar return comparison wheel",
    });
    await expect(wheel).toHaveAttribute("viewBox", "-90 -90 780 780");
    await expect(wheel.locator(".wheel-body--outer")).toHaveCount(13);
    await expect(
      page.getByRole("columnheader", {
        name: "Natal house",
        exact: true,
      }),
    ).toBeVisible();
    await expect(wheel).toHaveScreenshot("solar-return-bi-wheel.png");

    const pendingImage = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: `Download wheel as ${format}`,
      })
      .click();
    const image = await pendingImage;
    expect(image.suggestedFilename()).toContain("solar-return-2030-bi-wheel");
    const imagePath = testInfo.outputPath(`return.${format.toLowerCase()}`);
    await image.saveAs(imagePath);
    const content = await readFile(imagePath);
    if (format === "SVG") {
      expect(content.toString()).toContain("Solar return comparison wheel");
      expect(content.toString()).toContain("wheel-body--outer");
    } else {
      expect(content.readUInt32BE(16)).toBe(1560);
      expect(content.readUInt32BE(20)).toBe(1560);
    }

    const pendingCsv = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Download tables as CSV",
      })
      .click();
    const csv = await pendingCsv;
    const csvPath = testInfo.outputPath("return.csv");
    await csv.saveAs(csvPath);
    expect(await readFile(csvPath, "utf8")).toContain("Natal house");

    await page.getByRole("button", { name: "Copy link" }).click();
    const link = await page
      .getByRole("textbox", {
        name: "Share link",
      })
      .inputValue();
    await page.goto(`/${new URL(link).hash}`);
    await expect(
      page.getByRole("img", {
        name: "Solar return comparison wheel",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Solar return 2030",
      }),
    ).toBeVisible();
    await page.getByRole("radio", { name: "Return alone" }).check();
    await expect(
      page.getByRole("img", {
        name: "Solar return chart wheel",
      }),
    ).toBeVisible();
  });
}
