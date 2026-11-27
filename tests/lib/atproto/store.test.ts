import { describe, expect, it, vi } from "vitest";

import { CHART_COLLECTION, SPACE_KEY, SPACE_TYPE } from "@/lib/atproto/config";
import { buildChartRecord, TimeDisclosure } from "@/lib/atproto/record";
import { SpaceChartStore } from "@/lib/atproto/store";

import { CHART } from "../../fixtures/chart";
import { DID, SPACE } from "./fixtures";

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_FORBIDDEN = 403;

const RECORD = buildChartRecord(
  CHART.details,
  TimeDisclosure.Include,
  new Date("2026-11-13T12:00:00Z"),
);

function createStore() {
  const fetchHandler = vi.fn().mockResolvedValue(Response.json({}));
  const session = { did: DID, fetchHandler };
  return { store: new SpaceChartStore(session), fetchHandler };
}

describe("SpaceChartStore", () => {
  it("keeps the chart in the signed-in account's personal Space", () => {
    expect(SPACE).toBe(`at:space/${DID}/${SPACE_TYPE}/${SPACE_KEY}`);
  });
  it("creates a personal Space and returns its URI", async () => {
    const { store, fetchHandler } = createStore();
    fetchHandler.mockResolvedValue(Response.json({ space: SPACE }));
    expect(await store.createSpace()).toBe(SPACE);
    expect(fetchHandler.mock.calls[0][0]).toBe(
      "/xrpc/com.atproto.space.createSpace",
    );
    expect(JSON.parse(fetchHandler.mock.calls[0][1].body)).toEqual({
      spaceType: SPACE_TYPE,
      skey: SPACE_KEY,
      policy: { $type: "com.atproto.personalspace.policy" },
    });
  });
  it("rejects an unexpected URI after creation", async () => {
    const { store, fetchHandler } = createStore();
    fetchHandler.mockResolvedValue(Response.json({ space: "at://wrong" }));
    await expect(store.createSpace()).rejects.toThrow("unexpected Space URI");
  });
  it("reopens an existing personal Space", async () => {
    const { store, fetchHandler } = createStore();
    fetchHandler
      .mockResolvedValueOnce(
        Response.json(
          { error: "SpaceAlreadyExists" },
          { status: HTTP_STATUS_BAD_REQUEST },
        ),
      )
      .mockResolvedValueOnce(
        Response.json({
          space: SPACE,
          policy: { $type: "com.atproto.personalspace.policy" },
        }),
      );
    expect(await store.createSpace()).toBe(SPACE);
    expect(fetchHandler.mock.calls[1][0]).toContain(
      "/xrpc/com.atproto.space.getSpace?",
    );
  });
  it.each([
    { space: "at:space/wrong/example.test.type/self" },
    { space: SPACE, policy: { $type: "public" } },
  ])("rejects an unsafe existing Space: %j", async (body) => {
    const { store, fetchHandler } = createStore();
    fetchHandler
      .mockResolvedValueOnce(
        Response.json(
          { error: "SpaceAlreadyExists" },
          { status: HTTP_STATUS_BAD_REQUEST },
        ),
      )
      .mockResolvedValueOnce(Response.json(body));
    await expect(store.createSpace()).rejects.toThrow();
  });
  it("finds an existing personal Space", async () => {
    const { store, fetchHandler } = createStore();
    fetchHandler.mockResolvedValueOnce(
      Response.json({
        space: SPACE,
        policy: { $type: "com.atproto.personalspace.policy" },
      }),
    );
    expect(await store.findSpace()).toBe(SPACE);
    const params = new URLSearchParams({ space: SPACE });
    expect(fetchHandler.mock.calls[0][0]).toBe(
      `/xrpc/com.atproto.space.getSpace?${params}`,
    );
  });
  it("finds no Space when the PDS has none", async () => {
    const { store, fetchHandler } = createStore();
    fetchHandler.mockResolvedValueOnce(
      Response.json(
        { error: "SpaceNotFound" },
        { status: HTTP_STATUS_BAD_REQUEST },
      ),
    );
    expect(await store.findSpace()).toBeUndefined();
  });
  it.each([
    { space: "at:space/wrong/example.test.type/self" },
    { space: SPACE, policy: { $type: "public" } },
  ])("rejects an unsafe found Space: %j", async (body) => {
    const { store, fetchHandler } = createStore();
    fetchHandler.mockResolvedValueOnce(Response.json(body));
    await expect(store.findSpace()).rejects.toThrow();
  });
  it("surfaces lookup failures", async () => {
    const { store, fetchHandler } = createStore();
    fetchHandler.mockResolvedValueOnce(
      Response.json(
        { error: "NotAuthorized" },
        { status: HTTP_STATUS_FORBIDDEN },
      ),
    );
    await expect(store.findSpace()).rejects.toThrow("NotAuthorized");
  });
  it("surfaces creation failures", async () => {
    const { store, fetchHandler } = createStore();
    fetchHandler.mockResolvedValue(
      Response.json(
        { error: "UnsupportedPolicy" },
        { status: HTTP_STATUS_BAD_REQUEST },
      ),
    );
    await expect(store.createSpace()).rejects.toThrow("UnsupportedPolicy");
    expect(fetchHandler).toHaveBeenCalledTimes(1);
  });

  it("loads only the signed-in account's Space", async () => {
    const { store, fetchHandler } = createStore();
    fetchHandler.mockResolvedValue(Response.json({ value: RECORD }));
    expect((await store.loadChart())?.date).toEqual(CHART.details.date);
    const url = new URL(
      fetchHandler.mock.calls[0][0],
      "https://pds.example.com",
    );
    expect(url.pathname).toBe("/xrpc/com.atproto.space.getRecord");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      space: SPACE,
      repo: DID,
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
    expect(body.repo).toBe(DID);
    expect(body.space).toBe(SPACE);
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
      space: SPACE,
      repo: DID,
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
