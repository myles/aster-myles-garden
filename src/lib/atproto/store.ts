import {
  buildSpaceUri,
  CHART_COLLECTION,
  CHART_RECORD_KEY,
  PERSONAL_POLICY_TYPE,
  SPACE_KEY,
  SPACE_TYPE,
} from "./config";
import {
  buildChartRecord,
  parseChartRecord,
  TimeDisclosure,
  type ChartDetails,
} from "./record";

/** OAuth is handled by the SDK; the driver only receives its signed fetch. */
export type OAuthSession = {
  did: string;
  fetchHandler(path: string, init?: RequestInit): Promise<Response>;
};

/** Someone else's chart, kept in the account's own Space. */
export type PersonChart = { rkey: string; details: ChartDetails };

/** The signed-in account's charts, in its own personal Space. */
export class SpaceChartStore {
  private readonly _space: string;

  constructor(private readonly _session: OAuthSession) {
    this._space = buildSpaceUri(_session.did);
  }

  async createSpace(): Promise<string> {
    const response = await this._session.fetchHandler(
      "/xrpc/com.atproto.space.createSpace",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaceType: SPACE_TYPE,
          skey: SPACE_KEY,
          policy: { $type: PERSONAL_POLICY_TYPE },
        }),
      },
    );
    const body = await response.json();
    if (!response.ok) {
      if (body?.error !== "SpaceAlreadyExists") {
        throw new Error(
          `Couldn't create the Space (${body?.error ?? response.status}).`,
        );
      }
      // Reuse only a verified personal Space; never reset its policies.
      const existing = await this.findSpace();
      if (!existing) {
        throw new Error(
          "The existing Space could not be verified as personal.",
        );
      }
      return existing;
    }
    if (body?.space !== this._space) {
      throw new Error("The PDS returned an unexpected Space URI.");
    }
    return body.space;
  }

  /** The account's personal Space, or undefined if it isn't created yet. */
  async findSpace(): Promise<string | undefined> {
    const params = new URLSearchParams({ space: this._space });
    const response = await this._session.fetchHandler(
      `/xrpc/com.atproto.space.getSpace?${params}`,
    );
    const body = await response.json();
    if (!response.ok) {
      // Only an explicit missing Space is absent; other errors surface.
      if (body?.error === "SpaceNotFound") {
        return undefined;
      }
      throw new Error(
        `Couldn't look up the Space (${body?.error ?? response.status}).`,
      );
    }
    if (
      body?.space !== this._space ||
      body?.policy?.$type !== PERSONAL_POLICY_TYPE
    ) {
      throw new Error("The existing Space could not be verified as personal.");
    }
    return body.space;
  }

  async loadChart(): Promise<ChartDetails | undefined> {
    const params = new URLSearchParams(this._getRecordParams());
    const response = await this._session.fetchHandler(
      `/xrpc/com.atproto.space.getRecord?${params}`,
    );
    const body = await response.json();
    if (!response.ok) {
      // Only an explicit missing record is empty; other errors surface.
      if (body.error === "RecordNotFound") {
        return undefined;
      }
      throw new Error(`Couldn't load the chart (${response.status}).`);
    }
    return parseChartRecord(body.value);
  }

  async saveChart(
    details: ChartDetails,
    disclosure: TimeDisclosure,
  ): Promise<void> {
    await this._writeRecord("putRecord", {
      ...this._getRecordParams(),
      record: buildChartRecord(details, disclosure, new Date()),
    });
  }

  async deleteChart(): Promise<void> {
    await this._writeRecord("deleteRecord", this._getRecordParams());
  }

  /** Everyone whose chart is kept here, other than the account itself. */
  async listPeople(): Promise<PersonChart[]> {
    const people: PersonChart[] = [];
    let cursor: string | undefined;
    do {
      const params = new URLSearchParams({
        space: this._space,
        repo: this._session.did,
        collection: CHART_COLLECTION,
        ...(cursor !== undefined && { cursor }),
      });
      const response = await this._session.fetchHandler(
        `/xrpc/com.atproto.space.listRecords?${params}`,
      );
      if (!response.ok) {
        throw new Error(`Couldn't list saved people (${response.status}).`);
      }
      const body = await response.json();
      for (const record of body.records ?? []) {
        if (record.rkey === CHART_RECORD_KEY) {
          continue;
        }
        people.push({
          rkey: record.rkey,
          details: parseChartRecord(record.value),
        });
      }
      cursor = body.cursor;
    } while (cursor);
    return people;
  }

  /** Saves a new person under a key the PDS chooses, and returns it. */
  async addPerson(
    details: ChartDetails,
    disclosure: TimeDisclosure,
  ): Promise<string> {
    const { rkey: _, ...params } = this._getRecordParams();
    const response = await this._writeRecord("createRecord", {
      ...params,
      record: buildChartRecord(details, disclosure, new Date()),
    });
    // Example: "at:space/did:plc:…/garden.myles.aster.chart/3lbz2xq4kme2a"
    const { uri } = await response.json();
    const rkey = typeof uri === "string" ? uri.split("/").pop() : undefined;
    if (!rkey) {
      throw new Error("The PDS returned an unexpected record URI.");
    }
    return rkey;
  }

  async savePerson(
    rkey: string,
    details: ChartDetails,
    disclosure: TimeDisclosure,
  ): Promise<void> {
    await this._writeRecord("putRecord", {
      ...this._getRecordParams(_assertPersonKey(rkey)),
      record: buildChartRecord(details, disclosure, new Date()),
    });
  }

  async deletePerson(rkey: string): Promise<void> {
    await this._writeRecord(
      "deleteRecord",
      this._getRecordParams(_assertPersonKey(rkey)),
    );
  }

  private _getRecordParams(rkey: string = CHART_RECORD_KEY) {
    return {
      space: this._space,
      repo: this._session.did,
      collection: CHART_COLLECTION,
      rkey,
    };
  }

  private async _writeRecord(
    method: "createRecord" | "putRecord" | "deleteRecord",
    body: object,
  ): Promise<Response> {
    const response = await this._session.fetchHandler(
      `/xrpc/com.atproto.space.${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) {
      throw new Error(`Couldn't change the saved chart (${response.status}).`);
    }
    return response;
  }
}

/** People's keys must never reach the account's own chart. */
function _assertPersonKey(rkey: string): string {
  if (rkey === CHART_RECORD_KEY) {
    throw new Error("That key holds your own chart.");
  }
  return rkey;
}
