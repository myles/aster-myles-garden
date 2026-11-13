import type { BirthDetails } from "@/lib/chart";

import { CHART_COLLECTION, CHART_RECORD_KEY, type TrialConfig } from "./config";
import { buildChartRecord, parseChartRecord, TimeDisclosure } from "./record";

/** OAuth is handled by the SDK; the driver only receives its signed fetch. */
export type TrialSession = {
  did: string;
  fetchHandler(path: string, init?: RequestInit): Promise<Response>;
};

export class SpaceChartStore {
  constructor(
    private readonly _session: TrialSession,
    private readonly _config: TrialConfig,
  ) {
    const ownSpacePrefix = `at://${_session.did}/space/`;
    if (
      _session.did !== _config.allowedDid ||
      !_config.space.startsWith(ownSpacePrefix)
    ) {
      throw new Error("This trial is restricted to the configured account.");
    }
  }

  async createSpace(): Promise<string> {
    const response = await this._session.fetchHandler(
      "/xrpc/com.atproto.space.createSpace",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaceType: this._config.spaceType,
          skey: this._config.spaceKey,
          policy: { $type: "com.atproto.personalspace.policy" },
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
      const params = new URLSearchParams({ space: this._config.space });
      const existing = await this._session.fetchHandler(
        `/xrpc/com.atproto.space.getSpace?${params}`,
      );
      const description = await existing.json();
      if (
        !existing.ok ||
        description?.space !== this._config.space ||
        description?.policy?.$type !== "com.atproto.personalspace.policy"
      ) {
        throw new Error(
          "The existing Space could not be verified as personal.",
        );
      }
      return description.space;
    }
    if (body?.space !== this._config.space) {
      throw new Error("The PDS returned an unexpected Space URI.");
    }
    return body.space;
  }

  async loadChart(): Promise<BirthDetails | undefined> {
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
    details: BirthDetails,
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

  private _getRecordParams() {
    return {
      space: this._config.space,
      repo: this._session.did,
      collection: CHART_COLLECTION,
      rkey: CHART_RECORD_KEY,
    };
  }

  private async _writeRecord(
    method: "putRecord" | "deleteRecord",
    body: object,
  ): Promise<void> {
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
  }
}
