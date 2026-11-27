// Clients for an account's repo, from @atproto/lex: one that reads
// records anyone can read, and one logged in with an app password that
// writes the account's own. Both talk to the account's PDS directly.

import { Client } from "@atproto/lex-client";
import { PasswordSession } from "@atproto/lex-password-session";

const PLC_DIRECTORY_URL = "https://plc.directory";
const PDS_SERVICE_ID = "#atproto_pds";

type DidDocument = {
  service?: { id: string; serviceEndpoint: string }[];
};

/** The PDS that hosts a did:plc account. */
export async function resolvePdsUrl(did: string): Promise<string> {
  const response = await fetch(`${PLC_DIRECTORY_URL}/${did}`);
  if (!response.ok) {
    throw new Error(`Resolving ${did} failed with ${response.status}.`);
  }

  const document = (await response.json()) as DidDocument;
  const pds = document.service?.find(({ id }) => id === PDS_SERVICE_ID);
  if (!pds) {
    throw new Error(`${did} has no PDS in its DID document.`);
  }

  return pds.serviceEndpoint;
}

/** Reads the account's public records; no login is needed. */
export async function createPublicClient(did: string): Promise<Client> {
  return new Client(await resolvePdsUrl(did));
}

/** Logs in with an app password, never the account's main password. */
export async function loginWithAppPassword(
  did: string,
  identifier: string,
  password: string,
): Promise<Client> {
  const session = await PasswordSession.login({
    service: await resolvePdsUrl(did),
    identifier,
    password,
  });

  return new Client(session);
}
