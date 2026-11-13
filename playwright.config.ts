import { defineConfig, devices } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4399";
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } },
    },
  ],
  webServer: {
    // Keep Astro in the foreground so Playwright can stop it after tests.
    command:
      "npm run build && " +
      "npm run preview -- --ignore-lock --host 127.0.0.1 --port 4399",
    url: BASE_URL,
    reuseExistingServer: false,
  },
});
