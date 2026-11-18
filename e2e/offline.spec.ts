import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";

import { placeOptions } from "./places";

const PLACE_FIXTURE_PATH = fileURLToPath(
  new URL("./fixtures/places.json", import.meta.url),
);

test.use({ serviceWorkers: "allow" });

test("draws a chart offline once the site has been opened", async ({
  context,
  page,
}) => {
  // context.route also sees the worker's own requests.
  await context.route("**/data/places-*.json", (route) =>
    route.fulfill({
      path: PLACE_FIXTURE_PATH,
      contentType: "application/json",
    }),
  );

  await page.goto("/");
  await page.waitForFunction(() => navigator.serviceWorker.controller);

  // Search for a place while online, so the place index is cached too.
  const form = page.getByRole("form", { name: "Your birth details" });
  await form.getByRole("combobox", { name: "Place" }).fill("London");
  await expect(placeOptions(form).first()).toBeVisible();

  await context.setOffline(true);
  await page.reload();

  await expect(form.getByLabel("Date", { exact: true })).toBeEnabled();
  await form.getByLabel("Date", { exact: true }).fill("2000-01-01");
  await form.getByLabel("Time", { exact: true }).fill("12:00");
  await form.getByRole("combobox", { name: "Place" }).fill("London");
  await placeOptions(form).first().click();
  await form.getByRole("button", { name: "Draw chart" }).click();

  await expect(
    page.getByRole("img", { name: "Natal chart wheel" }),
  ).toBeVisible();
});
