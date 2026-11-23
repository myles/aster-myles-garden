// @vitest-environment jsdom

import { render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";

import Field from "@/components/ui/Field.svelte";

const CONTROL = createRawSnippet(() => ({ render: () => "<input id='x'>" }));
const HELP = createRawSnippet(() => ({
  render: () => "<button type='button'>?</button>",
}));

describe("Field", () => {
  it("puts its help beside the label", () => {
    render(Field, { id: "x", label: "Orbs", children: CONTROL, help: HELP });

    const label = screen.getByText("Orbs");
    const help = screen.getByRole("button", { name: "?" });
    expect(label.parentElement).toBe(help.parentElement);
  });

  it("has no help unless given some", () => {
    render(Field, { id: "x", label: "Orbs", children: CONTROL });

    expect(screen.queryByRole("button")).toBeNull();
  });
});
