import { readTrialConfig } from "./config";

/** Server-only build bridge; no trial settings are inferred at runtime. */
export function getTrialPaths() {
  const config = readTrialConfig({
    ASTER_ATPROTO_TRIAL:
      process.env.ASTER_ATPROTO_TRIAL ?? import.meta.env.ASTER_ATPROTO_TRIAL,
    ASTER_ATPROTO_DID:
      process.env.ASTER_ATPROTO_DID ?? import.meta.env.ASTER_ATPROTO_DID,
    ASTER_ATPROTO_SPACE:
      process.env.ASTER_ATPROTO_SPACE ?? import.meta.env.ASTER_ATPROTO_SPACE,
    ASTER_ATPROTO_ORIGIN:
      process.env.ASTER_ATPROTO_ORIGIN ?? import.meta.env.ASTER_ATPROTO_ORIGIN,
  });
  return config ? [{ params: { trial: "atproto" }, props: { config } }] : [];
}
