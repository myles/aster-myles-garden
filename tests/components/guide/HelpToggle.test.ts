// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import { GuideTopic, type GuideEntries } from "@/components/guide/topics";

import GuideHarness from "./GuideHarness.svelte";

const GUIDE = {
  [GuideTopic.HouseSystem]: {
    title: "House system",
    html: "<p>How the sky is <strong>divided</strong>.</p>",
  },
} as GuideEntries;

describe("HelpToggle", () => {
  it("starts closed", () => {
    render(GuideHarness, { guide: GUIDE, topic: GuideTopic.HouseSystem });

    const button = screen.getByRole("button", { name: "About House system" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(/How the sky is/)).toBeNull();
  });

  it("opens the topic's explanation, with a link to the guide", async () => {
    render(GuideHarness, { guide: GUIDE, topic: GuideTopic.HouseSystem });

    const button = screen.getByRole("button", { name: "About House system" });
    await fireEvent.click(button);

    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("divided").tagName).toBe("STRONG");
    expect(
      screen.getByRole("link", { name: "More in the guide" }),
    ).toHaveProperty(
      "href",
      "http://localhost:3000/guide/#settings-house-system",
    );
  });

  it("closes again", async () => {
    render(GuideHarness, { guide: GUIDE, topic: GuideTopic.HouseSystem });

    const button = screen.getByRole("button", { name: "About House system" });
    await fireEvent.click(button);
    await fireEvent.click(button);

    expect(screen.queryByText(/How the sky is/)).toBeNull();
  });

  it("shows nothing for a topic the guide doesn't have", () => {
    const { container } = render(GuideHarness, {
      guide: GUIDE,
      topic: GuideTopic.Orbs,
    });

    expect(container.textContent?.trim()).toBe("");
  });

  it("shows nothing without a guide", () => {
    const { container } = render(GuideHarness, {
      topic: GuideTopic.HouseSystem,
    });

    expect(container.textContent?.trim()).toBe("");
  });
});
