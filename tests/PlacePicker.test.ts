// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PlacePicker from "@/components/PlacePicker.svelte";
import { loadPlaceIndex } from "@/lib/places";

import { PLACE_INDEX } from "./fixtures/places";

vi.mock("@/lib/places", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/places")>()),
  loadPlaceIndex: vi.fn(),
}));

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

  it("reports a failed index load", async () => {
    vi.mocked(loadPlaceIndex).mockRejectedValue(new Error("Offline"));
    render(PlacePicker);

    await fireEvent.focus(screen.getByRole("combobox"));

    expect(
      await screen.findByText("Couldn't load places: Offline"),
    ).toBeTruthy();
  });
});
