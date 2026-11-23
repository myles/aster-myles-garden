import * as chart from "@/lexicons/garden/myles/aster/chart";
import * as space from "@/lexicons/garden/myles/aster/space";

export const APP_PATH = "/app/";
export const METADATA_PATH = "/app/client-metadata.json";
export const CHART_COLLECTION = chart.$nsid;
export const CHART_RECORD_KEY = "self";
export const SPACE_TYPE = space.$nsid;
export const SPACE_KEY = "self";
export const PERSONAL_POLICY_TYPE = "com.atproto.personalspace.policy";

const LOOPBACK_HOSTNAME = "127.0.0.1";

/** Every account keeps its chart in one personal Space of Aster's type. */
export function buildSpaceUri(did: string): string {
  return `at://${did}/space/${SPACE_TYPE}/${SPACE_KEY}`;
}

/**
 * The origin OAuth runs on. Only HTTPS can publish client metadata; plain
 * HTTP is allowed for local development on the numeric loopback host,
 * which loopback clients require. Example: "http://localhost:4321/app/"
 * throws, "http://127.0.0.1:4321/app/" gives "http://127.0.0.1:4321".
 */
export function parseAppOrigin(pageUrl: string): string {
  const url = new URL(pageUrl);
  const isLoopback =
    url.protocol === "http:" && url.hostname === LOOPBACK_HOSTNAME;

  if (url.protocol !== "https:" && !isLoopback) {
    throw new Error(
      `Open this page over HTTPS, or at http://${LOOPBACK_HOSTNAME} locally.`,
    );
  }

  return url.origin;
}

export function buildClientMetadata(origin: string) {
  const params = new URLSearchParams({
    authority: "self",
    skey: SPACE_KEY,
    collection: CHART_COLLECTION,
  });
  for (const action of ["read_self", "create", "update", "delete"]) {
    params.append("action", action);
  }
  params.set("manage", "create");
  const scope = `atproto space:${SPACE_TYPE}?${params}`;
  const redirectUri = new URL(APP_PATH, origin).href;
  const isLoopback = new URL(origin).protocol === "http:";
  const clientId = isLoopback
    ? `http://localhost?${new URLSearchParams({
        redirect_uri: redirectUri,
        scope,
      })}`
    : new URL(METADATA_PATH, origin).href;

  return {
    client_id: clientId,
    client_name: "Aster",
    client_uri: new URL("/", origin).href,
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
