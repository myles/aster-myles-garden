import { JSDOM } from "jsdom";
import { render } from "svelte/server";
import { describe, expect, it, vi } from "vitest";

import App from "@/components/App.svelte";

// The testing plugin resolves Svelte's client lifecycle exports even for
// server rendering. Match the server's no-op onMount behaviour here.
vi.mock("svelte", async (importOriginal) => ({
  ...(await importOriginal<typeof import("svelte")>()),
  onMount: vi.fn(),
}));

describe("App before hydration", () => {
  it("disables every birth control and excludes details from submission", () => {
    const { body } = render(App);
    const { window } = new JSDOM(body);
    const form = window.document.querySelector("form")!;
    const controls = form.querySelectorAll("input, select, button");

    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      expect(control.matches(":disabled")).toBe(true);
    }

    const date = form.querySelector<HTMLInputElement>('[name="date"]')!;
    date.value = "2000-01-01";
    expect([...new window.FormData(form)]).toEqual([]);
  });

  it("explains why JavaScript is required", () => {
    const { body } = render(App);
    const { window } = new JSDOM(body);

    expect(window.document.querySelector("form")?.textContent).toContain(
      "JavaScript is required",
    );
  });
});
