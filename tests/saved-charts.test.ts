// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addSavedChart,
  getBrowserStorage,
  readSavedCharts,
  removeSavedChart,
  SAVED_CHARTS_KEY,
} from "@/lib/saved-charts";

import { CHART } from "./fixtures/chart";

/** An in-memory stand-in for localStorage. */
class MemoryStorage implements Storage {
  private _items = new Map<string, string>();

  get length(): number {
    return this._items.size;
  }

  clear(): void {
    this._items.clear();
  }

  getItem(key: string): string | null {
    return this._items.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this._items.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this._items.delete(key);
  }

  setItem(key: string, value: string): void {
    this._items.set(key, value);
  }
}

/** A storage that refuses every write, as a full or locked-down one does. */
class FullStorage extends MemoryStorage {
  override setItem(): void {
    throw new DOMException("Quota exceeded", "QuotaExceededError");
  }
}

const ME = {
  name: "Me",
  date: "2000-01-01",
  time: "12:00",
  place: CHART.details.place,
};

describe("saved charts", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it("starts empty", () => {
    expect(readSavedCharts(storage)).toEqual([]);
  });

  it("saves a chart with an id, and reads it back", () => {
    const [saved] = addSavedChart(storage, ME);

    expect(saved).toEqual({ ...ME, id: expect.any(String) });
    expect(readSavedCharts(storage)).toEqual([saved]);
  });

  it("keeps an unknown birth time unknown", () => {
    const [saved] = addSavedChart(storage, { ...ME, time: undefined });

    expect(readSavedCharts(storage)[0].time).toBeUndefined();
    expect(saved.time).toBeUndefined();
  });

  it("keeps charts in the order they were saved", () => {
    addSavedChart(storage, ME);
    addSavedChart(storage, { ...ME, name: "Sam" });

    expect(readSavedCharts(storage).map((chart) => chart.name)).toEqual([
      "Me",
      "Sam",
    ]);
  });

  it("trims the name, and refuses a blank one", () => {
    expect(addSavedChart(storage, { ...ME, name: "  Me  " })[0].name).toBe(
      "Me",
    );
    expect(() => addSavedChart(storage, { ...ME, name: "   " })).toThrow(
      "Give the chart a name.",
    );
  });

  it("forgets a chart by id", () => {
    const [me] = addSavedChart(storage, ME);
    addSavedChart(storage, { ...ME, name: "Sam" });

    const remaining = removeSavedChart(storage, me.id);

    expect(remaining.map((chart) => chart.name)).toEqual(["Sam"]);
    expect(readSavedCharts(storage)).toEqual(remaining);
  });

  it("reports damaged storage rather than ignoring it", () => {
    storage.setItem(SAVED_CHARTS_KEY, "{not json");

    expect(() => readSavedCharts(storage)).toThrow("damaged");
  });

  it("reports a stored chart that isn't the right shape", () => {
    storage.setItem(
      SAVED_CHARTS_KEY,
      JSON.stringify({ version: 1, charts: [{ name: "Me" }] }),
    );

    expect(() => readSavedCharts(storage)).toThrow("damaged");
  });

  it("explains a storage that won't take the chart", () => {
    expect(() => addSavedChart(new FullStorage(), ME)).toThrow(
      "This browser wouldn't save the chart.",
    );
  });
});

describe("getBrowserStorage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("gives the browser's localStorage", () => {
    expect(getBrowserStorage()).toBe(window.localStorage);
  });

  it("explains a browser that blocks storage", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("Access denied", "SecurityError");
    });

    expect(() => getBrowserStorage()).toThrow(
      "This browser isn't letting the site save charts.",
    );
  });
});
