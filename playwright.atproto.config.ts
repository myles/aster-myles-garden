import { defineConfig } from "@playwright/test";

import base from "./playwright.config";

const webServer = base.webServer;
if (!webServer || Array.isArray(webServer)) {
  throw new Error("The trial suite requires the single preview server.");
}

// Synthetic identity only; this suite never signs into a live account.
const TRIAL_DID = "did:plc:aaaaaaaaaaaaaaaaaaaaaaaa";
const TRIAL_SPACE = `at://${TRIAL_DID}/space/garden.myles.aster.trial/self`;

export default defineConfig({
  ...base,
  metadata: { isAtprotoTrial: true },
  webServer: {
    ...webServer,
    env: {
      ASTER_ATPROTO_TRIAL: "true",
      ASTER_ATPROTO_DID: TRIAL_DID,
      ASTER_ATPROTO_SPACE: TRIAL_SPACE,
      ASTER_ATPROTO_ORIGIN: "http://127.0.0.1:4399",
    },
  },
});
