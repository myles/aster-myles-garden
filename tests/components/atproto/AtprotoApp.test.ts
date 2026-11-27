// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AtprotoApp from "@/components/atproto/AtprotoApp.svelte";
import { createAtprotoClient } from "@/lib/atproto/client";
import { TimeDisclosure } from "@/lib/atproto/record";
import { createChart, loadChartEngine } from "@/lib/charts/chart";
import { formatPlace, loadPlaceIndex } from "@/lib/places";

import { CHART } from "../../fixtures/chart";
import { PLACE_INDEX } from "../../fixtures/places";
import { DID, SPACE } from "../../lib/atproto/fixtures";

vi.mock("@/lib/atproto/client", () => ({
  createAtprotoClient: vi.fn(),
}));
vi.mock("@/lib/charts/chart", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/charts/chart")>()),
  createChart: vi.fn(),
  loadChartEngine: vi.fn(),
}));
vi.mock("@/lib/places", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/places")>()),
  loadPlaceIndex: vi.fn(),
}));

const charts = {
  findSpace: vi.fn(),
  createSpace: vi.fn(),
  loadChart: vi.fn(),
  saveChart: vi.fn(),
  deleteChart: vi.fn(),
  listPeople: vi.fn(),
  addPerson: vi.fn(),
  savePerson: vi.fn(),
  deletePerson: vi.fn(),
};
const client = {
  did: DID,
  charts,
  signIn: vi.fn(),
  signOut: vi.fn(),
  dispose: vi.fn(),
};

// The drawn chart is headed by its birthplace.
const CHART_HEADING = { name: formatPlace(CHART.details.place) };
const OWNERSHIP_LABEL =
  "These are my own details and I want to store them in my Space";
const PERMISSION_LABEL =
  "I have their permission to store these details in my Space";
const COMPARISON_HEADING = { name: "Chart comparison" };
const MUM = {
  rkey: "3lbz2xq4kme2a",
  details: { ...CHART.details, name: "Mum" },
};
const DAD = {
  rkey: "3lbz2xq4kme2b",
  details: { ...CHART.details, name: "Dad" },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("navigator", {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  // jsdom has no layout; the place picker scrolls its options.
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(loadChartEngine).mockResolvedValue(undefined);
  vi.mocked(createChart).mockReturnValue(CHART);
  vi.mocked(createAtprotoClient).mockResolvedValue(client);
  vi.mocked(loadPlaceIndex).mockResolvedValue(PLACE_INDEX);
  charts.findSpace.mockResolvedValue(SPACE);
  charts.createSpace.mockResolvedValue(SPACE);
  charts.loadChart.mockResolvedValue(CHART.details);
  charts.saveChart.mockResolvedValue(undefined);
  charts.deleteChart.mockResolvedValue(undefined);
  charts.listPeople.mockResolvedValue([]);
  charts.addPerson.mockResolvedValue(DAD.rkey);
  charts.savePerson.mockResolvedValue(undefined);
  charts.deletePerson.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function click(name: string): Promise<boolean> {
  return fireEvent.click(screen.getByRole("button", { name }));
}

async function findChart(): Promise<HTMLElement> {
  return screen.findByRole("heading", CHART_HEADING);
}

/** Opens the form for a saved chart, prefilled from the record. */
async function startEditing(): Promise<void> {
  render(AtprotoApp);
  await findChart();
  await click("Edit my details");
}

async function fillNewChart(): Promise<void> {
  await fireEvent.input(screen.getByLabelText("Date"), {
    target: { value: "2000-01-01" },
  });
  await fireEvent.input(screen.getByLabelText("Time"), {
    target: { value: "12:00" },
  });
  const input = screen.getByLabelText("Place");
  await fireEvent.focus(input);
  await vi.waitFor(() =>
    expect(screen.queryByText("Loading places…")).toBeNull(),
  );
  await fireEvent.input(input, { target: { value: "london, england" } });
  await fireEvent.keyDown(input, { key: "Enter" });
}

describe("AtprotoApp", () => {
  describe("signed out", () => {
    beforeEach(() => {
      vi.mocked(createAtprotoClient).mockResolvedValue({
        ...client,
        did: undefined,
        charts: undefined,
      });
    });

    it("offers only sign-in", async () => {
      render(AtprotoApp);
      expect(await screen.findByLabelText("Your handle")).toBeTruthy();
      expect(screen.queryByLabelText("Date")).toBeNull();
      expect(charts.findSpace).not.toHaveBeenCalled();
    });
    it("signs in with the handle entered", async () => {
      render(AtprotoApp);
      await fireEvent.input(await screen.findByLabelText("Your handle"), {
        target: { value: " you.bsky.social " },
      });
      await click("Sign in");
      expect(createAtprotoClient).toHaveBeenCalledWith(window.location.href);
      expect(client.signIn).toHaveBeenCalledWith("you.bsky.social");
    });
  });

  it("keeps birth entry disabled after OAuth failure", async () => {
    vi.mocked(createAtprotoClient).mockRejectedValue(new Error("OAuth failed"));
    render(AtprotoApp);
    await screen.findByText("OAuth failed");
    expect(screen.queryByLabelText("Date")).toBeNull();
    await fireEvent.input(screen.getByLabelText("Your handle"), {
      target: { value: "you.bsky.social" },
    });
    await click("Sign in");
    expect(screen.getByRole("alert").textContent).toContain("OAuth failed");
  });

  describe("with a saved chart", () => {
    it("shows it straight away, without the form", async () => {
      render(AtprotoApp);
      expect(await findChart()).toBeTruthy();
      expect(createChart).toHaveBeenCalledWith(CHART.details);
      expect(screen.queryByLabelText("Date")).toBeNull();
      expect(charts.createSpace).not.toHaveBeenCalled();
    });
    it("edits the saved details and redraws", async () => {
      await startEditing();
      expect(screen.getByLabelText<HTMLInputElement>("Date").value).toBe(
        "2000-01-01",
      );
      await fireEvent.click(screen.getByLabelText(OWNERSHIP_LABEL));
      await click("Save my chart");
      expect(charts.saveChart).toHaveBeenCalledWith(
        expect.objectContaining({ date: CHART.details.date }),
        TimeDisclosure.Omit,
      );
      expect(charts.createSpace).not.toHaveBeenCalled();
      // The drawn chart matches what was stored: no birth time.
      expect(createChart).toHaveBeenLastCalledWith(
        expect.objectContaining({ time: undefined }),
      );
      expect(await findChart()).toBeTruthy();
      expect(screen.queryByLabelText("Date")).toBeNull();
    });
    it("cancels editing without saving", async () => {
      await startEditing();
      await click("Cancel");
      expect(await findChart()).toBeTruthy();
      expect(screen.queryByLabelText("Date")).toBeNull();
      expect(charts.saveChart).not.toHaveBeenCalled();
    });
    it("includes time only when explicitly selected", async () => {
      await startEditing();
      await fireEvent.click(screen.getByLabelText(OWNERSHIP_LABEL));
      await fireEvent.click(
        screen.getByLabelText("Include my birth time in the saved record"),
      );
      await click("Save my chart");
      expect(charts.saveChart).toHaveBeenCalledWith(
        expect.objectContaining({ time: CHART.details.time }),
        TimeDisclosure.Include,
      );
    });
    it("preserves loaded AI preferences when saving", async () => {
      const aiPreferences = {
        training: { allow: false, updatedAt: "2026-11-13T12:00:00Z" },
      };
      charts.loadChart.mockResolvedValue({ ...CHART.details, aiPreferences });
      await startEditing();
      await fireEvent.click(screen.getByLabelText(OWNERSHIP_LABEL));
      await click("Save my chart");
      expect(charts.saveChart).toHaveBeenCalledWith(
        expect.objectContaining({ aiPreferences }),
        TimeDisclosure.Omit,
      );
    });
    it("requires confirmation of whose details are saved", async () => {
      await startEditing();
      await click("Save my chart");
      expect(screen.getByRole("alert").textContent).toContain(
        "Confirm these are your own",
      );
      expect(charts.saveChart).not.toHaveBeenCalled();
    });
    it("deletes the chart and returns to the empty form", async () => {
      render(AtprotoApp);
      await findChart();
      await click("Delete my saved chart");
      expect(charts.deleteChart).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("heading", CHART_HEADING)).toBeNull();
      expect(screen.getByLabelText<HTMLInputElement>("Date").value).toBe("");
    });
    it("keeps the chart when deletion fails", async () => {
      charts.deleteChart.mockRejectedValueOnce(new Error("Space unavailable"));
      render(AtprotoApp);
      await findChart();
      await click("Delete my saved chart");
      expect(screen.getByRole("alert").textContent).toContain(
        "Space unavailable",
      );
      expect(screen.getByRole("heading", CHART_HEADING)).toBeTruthy();
    });
    it("clears the chart when signing out", async () => {
      render(AtprotoApp);
      await findChart();
      await click("Sign out");
      expect(client.signOut).toHaveBeenCalled();
      expect(screen.queryByRole("heading", CHART_HEADING)).toBeNull();
      expect(screen.getByLabelText("Your handle")).toBeTruthy();
    });
  });

  describe("comparing with other people", () => {
    it("shows your chart alone and invites a comparison", async () => {
      render(AtprotoApp);
      expect(await findChart()).toBeTruthy();
      expect(screen.queryByRole("heading", COMPARISON_HEADING)).toBeNull();
      expect(screen.getByRole("button", { name: "Add someone" })).toBeTruthy();
    });
    it("compares you with the first person saved", async () => {
      charts.listPeople.mockResolvedValue([MUM, DAD]);
      render(AtprotoApp);
      expect(
        await screen.findByRole("heading", COMPARISON_HEADING),
      ).toBeTruthy();
      expect(createChart).toHaveBeenCalledWith(MUM.details);
      expect(screen.getByRole("button", { name: "Edit Mum" })).toBeTruthy();
    });
    it("switches who you're compared with", async () => {
      charts.listPeople.mockResolvedValue([MUM, DAD]);
      render(AtprotoApp);
      await screen.findByRole("heading", COMPARISON_HEADING);
      await fireEvent.change(screen.getByLabelText("Compare with"), {
        target: { value: DAD.rkey },
      });
      expect(screen.getByRole("button", { name: "Edit Dad" })).toBeTruthy();
    });
    it("adds someone with permission and compares with them", async () => {
      render(AtprotoApp);
      await findChart();
      await click("Add someone");
      await fireEvent.input(screen.getByLabelText("Name"), {
        target: { value: " Dad " },
      });
      await fillNewChart();
      await fireEvent.click(screen.getByLabelText(PERMISSION_LABEL));
      await click("Save their chart");
      expect(charts.addPerson).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Dad" }),
        TimeDisclosure.Omit,
      );
      expect(charts.saveChart).not.toHaveBeenCalled();
      expect(
        await screen.findByRole("heading", COMPARISON_HEADING),
      ).toBeTruthy();
    });
    it("requires permission and a name to store someone else", async () => {
      render(AtprotoApp);
      await findChart();
      await click("Add someone");
      await fillNewChart();
      await click("Save their chart");
      expect(screen.getByRole("alert").textContent).toContain(
        "Confirm you have their permission",
      );
      await fireEvent.click(screen.getByLabelText(PERMISSION_LABEL));
      await click("Save their chart");
      expect(screen.getByRole("alert").textContent).toContain("Enter a name");
      expect(charts.addPerson).not.toHaveBeenCalled();
    });
    it("edits someone by their key", async () => {
      charts.listPeople.mockResolvedValue([MUM]);
      render(AtprotoApp);
      await screen.findByRole("heading", COMPARISON_HEADING);
      await click("Edit Mum");
      expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("Mum");
      await fireEvent.click(screen.getByLabelText(PERMISSION_LABEL));
      await click("Save their chart");
      expect(charts.savePerson).toHaveBeenCalledWith(
        MUM.rkey,
        expect.objectContaining({ name: "Mum" }),
        TimeDisclosure.Omit,
      );
      expect(charts.saveChart).not.toHaveBeenCalled();
    });
    it("removes someone and falls back to your chart", async () => {
      charts.listPeople.mockResolvedValue([MUM]);
      render(AtprotoApp);
      await screen.findByRole("heading", COMPARISON_HEADING);
      await click("Remove Mum");
      expect(charts.deletePerson).toHaveBeenCalledWith(MUM.rkey);
      expect(screen.queryByRole("heading", COMPARISON_HEADING)).toBeNull();
      expect(screen.getByRole("heading", CHART_HEADING)).toBeTruthy();
    });
    it("keeps your chart when people can't be listed", async () => {
      charts.listPeople.mockRejectedValueOnce(new Error("List failed"));
      render(AtprotoApp);
      expect(await findChart()).toBeTruthy();
      expect((await screen.findByRole("alert")).textContent).toContain(
        "List failed",
      );
      await click("Try again");
      expect(charts.listPeople).toHaveBeenCalledTimes(2);
    });
  });

  describe("without a saved chart", () => {
    it("asks for details when the Space has no chart", async () => {
      charts.loadChart.mockResolvedValue(undefined);
      render(AtprotoApp);
      expect(await screen.findByLabelText("Date")).toBeTruthy();
      expect(screen.queryByRole("heading", CHART_HEADING)).toBeNull();
    });
    it("asks for details without reading a missing Space", async () => {
      charts.findSpace.mockResolvedValue(undefined);
      render(AtprotoApp);
      expect(await screen.findByLabelText("Date")).toBeTruthy();
      expect(charts.loadChart).not.toHaveBeenCalled();
    });
    it("creates the Space on first save, then shows the chart", async () => {
      charts.findSpace.mockResolvedValue(undefined);
      render(AtprotoApp);
      await screen.findByLabelText("Date");
      await fillNewChart();
      await fireEvent.click(screen.getByLabelText(OWNERSHIP_LABEL));
      await click("Save my chart");
      expect(charts.createSpace).toHaveBeenCalledTimes(1);
      expect(charts.createSpace.mock.invocationCallOrder[0]).toBeLessThan(
        charts.saveChart.mock.invocationCallOrder[0],
      );
      expect(await findChart()).toBeTruthy();
    });
    it("doesn't save when the Space can't be created", async () => {
      charts.findSpace.mockResolvedValue(undefined);
      charts.createSpace.mockRejectedValueOnce(new Error("Permission denied"));
      render(AtprotoApp);
      await screen.findByLabelText("Date");
      await fillNewChart();
      await fireEvent.click(screen.getByLabelText(OWNERSHIP_LABEL));
      await click("Save my chart");
      expect(screen.getByRole("alert").textContent).toContain(
        "Permission denied",
      );
      expect(charts.saveChart).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Date")).toBeTruthy();
    });
  });

  describe("when the chart can't be shown", () => {
    it.each([
      ["the Space lookup", () => charts.findSpace],
      ["loading the record", () => charts.loadChart],
    ])("surfaces a failure in %s and offers a retry", async (_, step) => {
      step().mockRejectedValueOnce(new Error("Lookup failed"));
      render(AtprotoApp);
      expect((await screen.findByRole("alert")).textContent).toContain(
        "Lookup failed",
      );
      // Never offer a blank form that could overwrite an unread chart.
      expect(screen.queryByLabelText("Date")).toBeNull();
      await click("Try again");
      expect(await findChart()).toBeTruthy();
    });
    it("surfaces a chart that can't be calculated", async () => {
      vi.mocked(loadChartEngine).mockRejectedValueOnce(new Error("No engine"));
      render(AtprotoApp);
      expect((await screen.findByRole("alert")).textContent).toContain(
        "No engine",
      );
      expect(screen.queryByRole("heading", CHART_HEADING)).toBeNull();
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    });
  });
});
