import { expect, test } from "@playwright/test";

test("loads the OAuth SDK and offers sign-in", async ({ page }) => {
  await page.goto("/app/");
  await expect(
    page.getByRole("heading", { name: "Your chart on AT Protocol" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  await expect(page.getByLabel("Date", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("alert")).toBeHidden();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("keeps sign-in disabled and renders no birth inputs", async ({
    page,
  }) => {
    await page.goto("/app/");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();
    await expect(page.getByLabel("Date", { exact: true })).toHaveCount(0);
  });
});
