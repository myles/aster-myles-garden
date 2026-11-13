import { describe, expect, it, vi } from "vitest";

import { CHART_COLLECTION } from "@/experimental/atproto/config";
import {
  buildChartRecord,
  TimeDisclosure,
} from "@/experimental/atproto/record";
import { SpaceChartStore } from "@/experimental/atproto/store";

import { CHART } from "../fixtures/chart";
import { CONFIG, OTHER_DID } from "./fixtures";

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_FORBIDDEN = 403;

const RECORD = buildChartRecord(
  CHART.details,
  TimeDisclosure.Include,
  new Date("2026-11-13T12:00:00Z"),
);

function createStore() {
  const fetchHandler = vi.fn().mockResolvedValue(Response.json({}));
  const session = { did: CONFIG.allowedDid, fetchHandler };
  return { store: new SpaceChartStore(session, CONFIG), fetchHandler };
}

describe("SpaceChartStore", () => {
  it("rejects any other account before making a request", () => {
    const fetchHandler = vi.fn();
    expect(
      () => new SpaceChartStore({ did: OTHER_DID, fetchHandler }, CONFIG),
    ).toThrow("restricted");
    expect(fetchHandler).not.toHaveBeenCalled();
  });
  it("rejects a Space owned by someone else", () => {
    expect(
      () =>
        new SpaceChartStore(
          {
            did: CONFIG.allowedDid,
            fetchHandler: vi.fn(),
          },
          {
            ...CONFIG,
            space: CONFIG.space.replace(CONFIG.allowedDid, OTHER_DID),
          },
        ),
    ).toThrow("restricted");
  });
  it("loads only the configured account and Space", async () => {
    const { store, fetchHandler } = createStore();
    fetchHandler.mockResolvedValue(Response.json({ value: RECORD }));
    expect((await store.loadChart())?.date).toEqual(CHART.details.date);
    const url = new URL(fetchHandler.mock.calls[0][0], CONFIG.origin);
    expect(url.pathname).toBe("/xrpc/com.atproto.space.getRecord");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      space: CONFIG.space,
      repo: CONFIG.allowedDid,
      collection: CHART_COLLECTION,
      rkey: "self",
    });
  });
  it("treats only an explicit missing record as empty", async () => {
    const { store, fetchHandler } = createStore();
    fetchHandler.mockResolvedValue(
      Response.json(
        { error: "RecordNotFound" },
        { status: HTTP_STATUS_BAD_REQUEST },
      ),
    );
    expect(await store.loadChart()).toBeUndefined();
  });
  it.each(["SpaceNotFound", "RepoNotFound", "AuthenticationRequired"])(
    "surfaces %s",
    async (error) => {
      const { store, fetchHandler } = createStore();
      fetchHandler.mockResolvedValue(
        Response.json({ error }, { status: HTTP_STATUS_BAD_REQUEST }),
      );
      await expect(store.loadChart()).rejects.toThrow("Couldn't load");
    },
  );
  it("rejects malformed record responses", async () => {
    const { store, fetchHandler } = createStore();
    fetchHandler.mockResolvedValue(Response.json({ value: {} }));
    await expect(store.loadChart()).rejects.toThrow();
  });
  it("writes only the own-chart singleton", async () => {
    const { store, fetchHandler } = createStore();
    await store.saveChart(CHART.details, TimeDisclosure.Omit);
    const [path, init] = fetchHandler.mock.calls[0];
    expect(path).toBe("/xrpc/com.atproto.space.putRecord");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.repo).toBe(CONFIG.allowedDid);
    expect(body.space).toBe(CONFIG.space);
    expect(body.rkey).toBe("self");
    expect(body.record).not.toHaveProperty("birthTime");
  });
  it("deletes the same singleton", async () => {
    const { store, fetchHandler } = createStore();
    await store.deleteChart();
    expect(fetchHandler.mock.calls[0][0]).toBe(
      "/xrpc/com.atproto.space.deleteRecord",
    );
    expect(JSON.parse(fetchHandler.mock.calls[0][1].body)).toEqual({
      space: CONFIG.space,
      repo: CONFIG.allowedDid,
      collection: CHART_COLLECTION,
      rkey: "self",
    });
  });
  it("surfaces failures without public fallback", async () => {
    const { store, fetchHandler } = createStore();
    fetchHandler.mockResolvedValue(
      new Response(null, { status: HTTP_STATUS_FORBIDDEN }),
    );
    await expect(
      store.saveChart(CHART.details, TimeDisclosure.Include),
    ).rejects.toThrow("403");
    expect(fetchHandler).toHaveBeenCalledTimes(1);
    await expect(store.deleteChart()).rejects.toThrow("403");
    fetchHandler.mockRejectedValue(new Error("offline"));
    await expect(store.loadChart()).rejects.toThrow("offline");
  });
});
