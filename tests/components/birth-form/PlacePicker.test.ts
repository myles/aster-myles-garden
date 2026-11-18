// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PlacePicker from "@/components/birth-form/PlacePicker.svelte";
import {
  loadPlaceIndex,
  loadTopPlaceIndex,
  parsePlaceIndex,
  type PlaceIndex,
} from "@/lib/places";

import { PLACE_INDEX } from "../../fixtures/places";

vi.mock("@/lib/places", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/places")>()),
  loadPlaceIndex: vi.fn(),
  loadTopPlaceIndex: vi.fn(),
}));

/** A promise to settle from the test, as a slow download would. */
function defer<T>() {
  return Promise.withResolvers<T>();
}

function buildIndex(names: string[]): PlaceIndex {
  return parsePlaceIndex({
    timeZones: ["Europe/London"],
    places: names.map((name, id) => [name, "", "", "", 0, 0, 0, id + 1]),
  });
}

function listOptions(): (string | null)[] {
  return screen.getAllByRole("option").map((option) => option.textContent);
}

async function type(input: HTMLElement, text: string): Promise<void> {
  await fireEvent.focus(input);
  // The index loads on focus; wait for it before typing.
  await vi.waitFor(() =>
    expect(screen.queryByText("Loading places…")).toBeNull(),
  );
  await fireEvent.input(input, { target: { value: text } });
}

describe("PlacePicker", () => {
  beforeEach(() => {
    vi.mocked(loadPlaceIndex).mockReset().mockResolvedValue(PLACE_INDEX);
    vi.mocked(loadTopPlaceIndex)
      .mockReset()
      .mockRejectedValue(new Error("Not needed"));
    // jsdom has no layout, so it lacks scrollIntoView.
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("lists matching places as options", async () => {
    render(PlacePicker);
    const input = screen.getByRole("combobox");

    await type(input, "london");

    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "London, England, United Kingdom",
      "London, Ontario, Canada",
    ]);
  });

  it("chooses the active option with the keyboard", async () => {
    render(PlacePicker);
    const input = screen.getByRole("combobox") as HTMLInputElement;

    await type(input, "london");
    await fireEvent.keyDown(input, { key: "ArrowDown" });
    await fireEvent.keyDown(input, { key: "Enter" });

    expect(input.value).toBe("London, Ontario, Canada");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("Time zone: America/Toronto")).toBeTruthy();
  });

  it("chooses an option by pointer", async () => {
    render(PlacePicker);
    const input = screen.getByRole("combobox") as HTMLInputElement;

    await type(input, "toronto");
    await fireEvent.mouseDown(screen.getByRole("option"));

    expect(input.value).toBe("Toronto, Ontario, Canada");
  });

  it("forgets the choice once the text is edited", async () => {
    render(PlacePicker);
    const input = screen.getByRole("combobox");

    await type(input, "toronto");
    await fireEvent.keyDown(input, { key: "Enter" });
    await fireEvent.input(input, { target: { value: "toront" } });

    expect(screen.queryByText(/Time zone/)).toBeNull();
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });

  it("reopens the suggestions when the field is focused again", async () => {
    render(PlacePicker);
    const input = screen.getByRole("combobox");

    await type(input, "london");
    await fireEvent.blur(input);
    expect(input.getAttribute("aria-expanded")).toBe("false");

    await fireEvent.focus(input);

    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("reopens the suggestions with Arrow Down", async () => {
    render(PlacePicker);
    const input = screen.getByRole("combobox");

    await type(input, "london");
    await fireEvent.keyDown(input, { key: "Escape" });
    expect(input.getAttribute("aria-expanded")).toBe("false");

    await fireEvent.keyDown(input, { key: "ArrowDown" });

    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(input.getAttribute("aria-activedescendant")).toBe(
      "birth-place-option-0",
    );
  });

  it("keeps a chosen place's suggestions closed", async () => {
    render(PlacePicker);
    const input = screen.getByRole("combobox");

    await type(input, "toronto");
    await fireEvent.keyDown(input, { key: "Enter" });
    await fireEvent.blur(input);
    await fireEvent.focus(input);
    await fireEvent.keyDown(input, { key: "ArrowDown" });

    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("reports a failed index load", async () => {
    vi.mocked(loadPlaceIndex).mockRejectedValue(new Error("Offline"));
    render(PlacePicker);

    await fireEvent.focus(screen.getByRole("combobox"));

    expect(
      await screen.findByText("Couldn't load places: Offline"),
    ).toBeTruthy();
  });

  it("searches the biggest cities while the rest load", async () => {
    const whole = defer<PlaceIndex>();
    vi.mocked(loadPlaceIndex).mockReturnValue(whole.promise);
    vi.mocked(loadTopPlaceIndex).mockResolvedValue(buildIndex(["London"]));
    render(PlacePicker);
    const input = screen.getByRole("combobox");

    await fireEvent.focus(input);
    expect(await screen.findByText("Loading smaller places…")).toBeTruthy();
    await fireEvent.input(input, { target: { value: "london" } });
    expect(listOptions()).toEqual(["London"]);

    whole.resolve(buildIndex(["London", "Londonderry"]));
    await vi.waitFor(() => expect(listOptions()).toHaveLength(2));
    expect(screen.queryByText("Loading smaller places…")).toBeNull();
  });

  it("keeps the highlighted place when the rest arrive", async () => {
    const whole = defer<PlaceIndex>();
    vi.mocked(loadPlaceIndex).mockReturnValue(whole.promise);
    // "ton" is inside Hamilton's name, but starts Tonbridge's, which ranks
    // it first once the whole index is searched.
    vi.mocked(loadTopPlaceIndex).mockResolvedValue(buildIndex(["Hamilton"]));
    render(PlacePicker);
    const input = screen.getByRole("combobox") as HTMLInputElement;

    await fireEvent.focus(input);
    await screen.findByText("Loading smaller places…");
    await fireEvent.input(input, { target: { value: "ton" } });
    whole.resolve(buildIndex(["Hamilton", "Tonbridge"]));
    await vi.waitFor(() =>
      expect(listOptions()).toEqual(["Tonbridge", "Hamilton"]),
    );
    await fireEvent.keyDown(input, { key: "Enter" });

    expect(input.value).toBe("Hamilton");
  });

  it("loads once however often the field is focused", async () => {
    render(PlacePicker);
    const input = screen.getByRole("combobox");

    await fireEvent.focus(input);
    await fireEvent.blur(input);
    await fireEvent.focus(input);
    await vi.waitFor(() =>
      expect(screen.queryByText("Loading places…")).toBeNull(),
    );
    await fireEvent.focus(input);

    expect(loadPlaceIndex).toHaveBeenCalledOnce();
  });
});
