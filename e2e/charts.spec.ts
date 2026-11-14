import { expect, test, type Locator, type Page } from "@playwright/test";
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
    await wheel.screenshot({ path: testInfo.outputPath("wheel.png") });

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
