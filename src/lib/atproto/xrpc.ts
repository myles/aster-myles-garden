// A small client for the AT Protocol endpoints Aster uses: finding an
// account's PDS, reading records anyone can read and, with a session,
// writing the account's own. Plain fetch, so neither the site's server
// nor the release scripts need an SDK.

const PLC_DIRECTORY_URL = "https://plc.directory";
const PDS_SERVICE_ID = "#atproto_pds";

/** The most records the PDS returns per page. */
const MAX_RECORDS_PER_PAGE = 100;

const JSON_CONTENT_TYPE = "application/json";

/** A record's URI and the CID of the exact version it points at. */
export type StrongRef = { uri: string; cid: string };

/** An uploaded file, as records embed it. */
export type BlobRef = {
  $type: "blob";
  ref: { $link: string };
  mimeType: string;
  size: number;
};

export type ListedRecord = { uri: string; cid: string; value: unknown };

/** A logged-in account, for writing to its own repo. */
export type Session = { pdsUrl: string; did: string; accessJwt: string };

type DidDocument = {
  service?: { id: string; serviceEndpoint: string }[];
};

type RecordPage = { records: ListedRecord[]; cursor?: string };

export class XrpcError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "XrpcError";
    this.status = status;
  }
}

/** The PDS that hosts a did:plc account. */
export async function resolvePdsUrl(did: string): Promise<string> {
  const response = await fetch(`${PLC_DIRECTORY_URL}/${did}`);
  const document = (await _readJson(response, did)) as DidDocument;

  const pds = document.service?.find(({ id }) => id === PDS_SERVICE_ID);
  if (!pds) {
    throw new Error(`${did} has no PDS in its DID document.`);
  }

  return pds.serviceEndpoint;
}

/** Every record in one of a repo's collections, across pages. */
export async function listRecords(
  pdsUrl: string,
  repo: string,
  collection: string,
): Promise<ListedRecord[]> {
  const records: ListedRecord[] = [];
  let cursor: string | undefined;

  do {
    const url = new URL(`${pdsUrl}/xrpc/com.atproto.repo.listRecords`);
    url.searchParams.set("repo", repo);
    url.searchParams.set("collection", collection);
    url.searchParams.set("limit", String(MAX_RECORDS_PER_PAGE));
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    // Each page needs the cursor from the one before it.
    // oxlint-disable-next-line no-await-in-loop
    const response = await fetch(url);
    // oxlint-disable-next-line no-await-in-loop
    const page = (await _readJson(response, "listRecords")) as RecordPage;

    records.push(...page.records);
    cursor = page.records.length > 0 ? page.cursor : undefined;
  } while (cursor);

  return records;
}

/** Logs in with an app password, never the account's main password. */
export async function createSession(
  pdsUrl: string,
  identifier: string,
  password: string,
): Promise<Session> {
  const body = await _call(pdsUrl, "com.atproto.server.createSession", {
    body: JSON.stringify({ identifier, password }),
    contentType: JSON_CONTENT_TYPE,
  });
  const { did, accessJwt } = body as { did: string; accessJwt: string };

  return { pdsUrl, did, accessJwt };
}

/** Writes a new record, keyed by the PDS with a fresh TID. */
export async function createRecord(
  session: Session,
  collection: string,
  record: object,
): Promise<StrongRef> {
  const body = await _call(session.pdsUrl, "com.atproto.repo.createRecord", {
    body: JSON.stringify({ repo: session.did, collection, record }),
    contentType: JSON_CONTENT_TYPE,
    accessJwt: session.accessJwt,
  });

  return _toStrongRef(body);
}

/** Writes a record at a known key, replacing whatever was there. */
export async function putRecord(
  session: Session,
  collection: string,
  rkey: string,
  record: object,
): Promise<StrongRef> {
  const body = await _call(session.pdsUrl, "com.atproto.repo.putRecord", {
    body: JSON.stringify({ repo: session.did, collection, rkey, record }),
    contentType: JSON_CONTENT_TYPE,
    accessJwt: session.accessJwt,
  });

  return _toStrongRef(body);
}

export async function uploadBlob(
  session: Session,
  bytes: Uint8Array<ArrayBuffer>,
  mimeType: string,
): Promise<BlobRef> {
  const body = await _call(session.pdsUrl, "com.atproto.repo.uploadBlob", {
    body: bytes,
    contentType: mimeType,
    accessJwt: session.accessJwt,
  });

  return (body as { blob: BlobRef }).blob;
}

/**
 * The last part of an AT-URI, the record's key. Example:
 * "at://did:plc:abc/site.standard.document/3lwafzkjqm25s" → "3lwafzkjqm25s".
 */
export function toRecordKey(uri: string): string {
  const rkey = uri.split("/").at(-1);
  if (!rkey) {
    throw new Error(`${uri} has no record key.`);
  }

  return rkey;
}

type CallOptions = {
  body: BodyInit;
  contentType: string;
  accessJwt?: string;
};

async function _call(
  pdsUrl: string,
  method: string,
  { body, contentType, accessJwt }: CallOptions,
): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": contentType };
  if (accessJwt) {
    headers.Authorization = `Bearer ${accessJwt}`;
  }

  const response = await fetch(`${pdsUrl}/xrpc/${method}`, {
    method: "POST",
    headers,
    body,
  });

  return _readJson(response, method);
}

/** The response's JSON, or an error carrying what the server said. */
async function _readJson(response: Response, what: string): Promise<unknown> {
  if (!response.ok) {
    const detail = await response.text();
    throw new XrpcError(
      response.status,
      `${what} failed with ${response.status}: ${detail}`,
    );
  }

  return response.json();
}

function _toStrongRef(body: unknown): StrongRef {
  const { uri, cid } = body as StrongRef;

  return { uri, cid };
}
