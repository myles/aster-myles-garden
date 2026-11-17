// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import ComponentGallery from "@/dev/ComponentGallery.svelte";

describe("ComponentGallery", () => {
  it("shows a section for each kind of building block", () => {
    render(ComponentGallery);

    for (const name of [
      "Colours",
      "Type",
      "Buttons",
      "Fields",
      "Messages",
      "Panels",
      "Tables",
    ]) {
      expect(screen.getByRole("heading", { name, level: 2 })).toBeTruthy();
    }
  });

  it("shows every button variant, enabled and disabled", () => {
    const { container } = render(ComponentGallery);

    for (const variant of ["primary", "secondary", "action", "tool", "quiet"]) {
      const buttons = container.querySelectorAll(`.ui-button--${variant}`);
      expect(buttons.length, variant).toBeGreaterThanOrEqual(2);
      expect(
        [...buttons].some((button) => button.hasAttribute("disabled")),
        variant,
      ).toBe(true);
    }
  });

  it("works like the real thing: the panel submits", async () => {
    render(ComponentGallery);

    await fireEvent.click(
      screen
        .getByRole("form", { name: "Transit moment" })
        .querySelector("button[type=submit]")!,
    );

    expect(screen.getByText("Submitted 1 time.")).toBeTruthy();
  });

  it("toggles the pressed tool button", async () => {
    render(ComponentGallery);
    const button = screen.getByRole("button", { name: "Enlarge wheel" });

    await fireEvent.click(button);

    expect(button.getAttribute("aria-pressed")).toBe("true");
  });
});
