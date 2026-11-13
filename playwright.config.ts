import { defineConfig, devices } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4399";
const isCI = Boolean(process.env.CI);
// Wheel glyphs come from the system's symbol fonts, so screenshots only
// match where they were approved: Linux, in Playwright's Docker image.
// Elsewhere they're skipped; run scripts/e2e-linux-run.sh to compare.
const isSnapshotPlatform = process.platform === "linux";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  ignoreSnapshots: !isSnapshotPlatform,
  // One baseline per project, without the platform, since only Linux's
  // are kept.
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}-{projectName}{ext}",
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
    env: { ASTER_ATPROTO_TRIAL: "false" },
  },
});
