import { describe, expect, it } from "vitest";

import { AspectSet, OrbSize } from "@/lib/astrology/aspects";
import { HouseSystem } from "@/lib/astrology/houses";
import {
  PREFERENCES_KEY,
  readPreferences,
  writePreferences,
} from "@/lib/storage/preferences";

import { FullStorage, MemoryStorage } from "./fixtures/storage";

const PREFERENCES = {
  houseSystem: HouseSystem.WholeSign,
  aspectSettings: { aspectSet: AspectSet.All, orbSize: OrbSize.Tight },
};

describe("readPreferences", () => {
  it("is undefined when nothing's been saved", () => {
    expect(readPreferences(new MemoryStorage())).toBeUndefined();
  });

  it("reads back what was written", () => {
    const storage = new MemoryStorage();

    writePreferences(storage, PREFERENCES);

    expect(readPreferences(storage)).toEqual(PREFERENCES);
  });

  it.each([
    ["isn't JSON", "{"],
    ["is from another version", JSON.stringify({ version: 99 })],
    [
      "names an unknown house system",
      JSON.stringify({
        version: 1,
        houseSystem: "topocentric",
        aspectSet: "all",
        orbSize: "tight",
      }),
    ],
    [
      "names an unknown orb size",
      JSON.stringify({
        version: 1,
        houseSystem: "koch",
        aspectSet: "all",
        orbSize: "huge",
      }),
    ],
  ])("throws when what's stored %s", (_, raw) => {
    const storage = new MemoryStorage();
    storage.setItem(PREFERENCES_KEY, raw);

    expect(() => readPreferences(storage)).toThrow("settings are damaged");
  });
});

describe("writePreferences", () => {
  it("says so when the browser won't save", () => {
    expect(() => writePreferences(new FullStorage(), PREFERENCES)).toThrow(
      "wouldn't save",
    );
  });
});
