import { expect, test } from "@playwright/test";

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_NOT_FOUND = 404;

test("isolates the personal trial from the default build", async ({
  page,
  request,
}, testInfo) => {
  const isTrial = testInfo.config.metadata.isAtprotoTrial === true;
  const response = await page.goto("/trials/atproto/");
  expect(response?.status()).toBe(
    isTrial ? HTTP_STATUS_OK : HTTP_STATUS_NOT_FOUND,
  );
  const metadata = await request.get("/trials/atproto/client-metadata.json");
  expect(metadata.status()).toBe(
    isTrial ? HTTP_STATUS_OK : HTTP_STATUS_NOT_FOUND,
  );
  if (!isTrial) {
    return;
  }

  await expect(
    page.getByRole("heading", {
      name: "Aster · personal AT Protocol trial",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Sign in to my trial account",
    }),
  ).toBeEnabled();
  await expect(page.getByLabel("Date", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("alert")).toBeHidden();
  expect((await metadata.json()).scope).toContain("action=read_self");
});

test.describe("trial without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("keeps sign-in disabled and renders no birth inputs", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.config.metadata.isAtprotoTrial !== true,
      "Only the explicitly enabled test build emits this route",
    );
    await page.goto("/trials/atproto/");
    await expect(
      page.getByRole("button", {
        name: "Sign in to my trial account",
      }),
    ).toBeDisabled();
    await expect(page.getByLabel("Date", { exact: true })).toHaveCount(0);
  });
});
