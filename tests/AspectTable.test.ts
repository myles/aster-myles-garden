// @vitest-environment jsdom

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import AspectTable from "@/components/AspectTable.svelte";

describe("AspectTable", () => {
  it("spans every column when there are no aspects", () => {
    render(AspectTable, { aspects: [], settings: undefined });

    const columns = screen.getAllByRole("columnheader");
    const cell = screen.getByText("No major aspects within orb.");

    expect(cell.closest("tr")?.children).toHaveLength(1);
    expect(cell.getAttribute("colspan")).toBe(String(columns.length));
  });
});
