export const TRIAL_PATH = "/trials/atproto/";
export const METADATA_PATH = "/trials/atproto/client-metadata.json";
export const CHART_COLLECTION = "garden.myles.aster.chart";
export const CHART_RECORD_KEY = "self";
const DEFAULT_SPACE_TYPE = "garden.myles.aster.trial";

const DID_PATTERN = /^did:(plc:[a-z2-7]{24}|web:[A-Za-z0-9._:%-]+)$/;
const SPACE_PATTERN = /^at:\/\/([^/]+)\/space\/([^/]+)\/([^/]+)$/;
const NSID_PATTERN = /^[a-zA-Z][\w-]*(\.[a-zA-Z][\w-]*){2,}$/;

export type TrialConfig = {
  allowedDid: string;
  space: string;
  spaceType: string;
  spaceKey: string;
  origin: string;
};

/** No trial routes are built unless explicitly enabled. */
export function readTrialConfig(
  env: Record<string, string | undefined>,
): TrialConfig | undefined {
  if (env.ASTER_ATPROTO_TRIAL !== "true") {
    return undefined;
  }

  const allowedDid = env.ASTER_ATPROTO_DID ?? "";
  const space =
    env.ASTER_ATPROTO_SPACE ||
    `at://${allowedDid}/space/${DEFAULT_SPACE_TYPE}/self`;
  const match = SPACE_PATTERN.exec(space);
  if (!DID_PATTERN.test(allowedDid) || !match || match[1] !== allowedDid) {
    throw new Error("Set a trial DID and a Space owned by that same DID.");
  }
  if (!NSID_PATTERN.test(match[2]) || !/^[\w.~-]+$/.test(match[3])) {
    throw new Error("The trial Space URI is malformed.");
  }

  const origin = new URL(env.ASTER_ATPROTO_ORIGIN ?? "");
  const isLoopback = origin.hostname === "127.0.0.1";
  if (
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/" ||
    (origin.protocol !== "https:" &&
      !(isLoopback && origin.protocol === "http:"))
  ) {
    throw new Error("Use an HTTPS origin or http://127.0.0.1 with a port.");
  }

  return {
    allowedDid,
    space,
    spaceType: match[2],
    spaceKey: match[3],
    origin: origin.origin,
  };
}

export function buildClientMetadata(config: TrialConfig) {
  const params = new URLSearchParams({
    authority: "self",
    skey: config.spaceKey,
    collection: CHART_COLLECTION,
  });
  for (const action of ["read_self", "create", "update", "delete"]) {
    params.append("action", action);
  }
  params.set("manage", "create");
  const scope = `atproto space:${config.spaceType}?${params}`;
  const redirectUri = new URL(TRIAL_PATH, config.origin).href;
  const isLoopback = new URL(config.origin).protocol === "http:";
  const clientId = isLoopback
    ? `http://localhost?${new URLSearchParams({
        redirect_uri: redirectUri,
        scope,
      })}`
    : new URL(METADATA_PATH, config.origin).href;

  return {
    client_id: clientId,
    client_name: "Aster personal trial",
    client_uri: new URL(TRIAL_PATH, config.origin).href,
    redirect_uris: [redirectUri] as [string],
    scope,
    grant_types: ["authorization_code", "refresh_token"] as [
      "authorization_code",
      "refresh_token",
    ],
    response_types: ["code"] as ["code"],
    token_endpoint_auth_method: "none" as const,
    application_type: isLoopback ? ("native" as const) : ("web" as const),
    dpop_bound_access_tokens: true,
  };
}
