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
    // A worker answers requests before page.route sees them, so it's
    // blocked except in the tests for working offline.
    serviceWorkers: "block",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } },
    },
  ],
  webServer: {
    // `astro preview` doesn't run under the Vercel adapter, so Vite serves
    // the built static site. The browser tests don't call the API. Keep it
    // in the foreground so Playwright can stop it after tests.
    command:
      "npm run build && " +
      "vite preview --outDir dist/client --host 127.0.0.1 --port 4399 " +
      "--strictPort",
    url: BASE_URL,
    reuseExistingServer: false,
  },
});
