import type { TrialConfig } from "@/experimental/atproto/config";

export const TRIAL_DID = "did:plc:aaaaaaaaaaaaaaaaaaaaaaaa";
export const OTHER_DID = "did:plc:bbbbbbbbbbbbbbbbbbbbbbbb";
export const CONFIG: TrialConfig = {
  allowedDid: TRIAL_DID,
  space: `at://${TRIAL_DID}/space/garden.myles.aster.space/self`,
  spaceType: "garden.myles.aster.space",
  spaceKey: "self",
  origin: "http://127.0.0.1:4321",
};
export const ENV = {
  ASTER_ATPROTO_TRIAL: "true",
  ASTER_ATPROTO_DID: CONFIG.allowedDid,
  ASTER_ATPROTO_SPACE: CONFIG.space,
  ASTER_ATPROTO_ORIGIN: CONFIG.origin,
};
