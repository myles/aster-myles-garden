import { expect, test } from "@playwright/test";

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("blocks birth entry and native submission", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText("JavaScript is required", { exact: false }),
    ).toBeVisible();
    const form = page.getByRole("form", { name: "Your birth details" });
    const controls = form.locator("input, select, button");
    await Promise.all(
      (await controls.all()).map((control) => expect(control).toBeDisabled()),
    );

    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    // Click and keyboard input must not submit a disabled native form.
    await form
      .getByRole("button", { name: "Draw chart" })
      .click({ force: true });
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/");
    expect(requests.filter((url) => new URL(url).search)).toEqual([]);
  });
});

test("keeps controls disabled while hydration is delayed", async ({ page }) => {
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  await page.route("**/*.js", async (route) => {
    await scriptsReady;
    await route.continue();
  });
  try {
    await page.goto("/", { waitUntil: "commit" });
    const date = page.getByLabel("Date", { exact: true });
    await expect(date).toBeDisabled();
    await expect(
      page.getByText("JavaScript is required", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Draw chart" }),
    ).toBeDisabled();
    releaseScripts();
    await expect(date).toBeEnabled();
    await expect(
      page.getByText("JavaScript is required", { exact: false }),
    ).toHaveCount(0);
  } finally {
    releaseScripts();
  }
});
