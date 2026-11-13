// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTrialClient } from "@/experimental/atproto/client";
import { TimeDisclosure } from "@/experimental/atproto/record";
import TrialApp from "@/experimental/atproto/TrialApp.svelte";
import { loadPlaceIndex } from "@/lib/places";

import { CHART } from "../fixtures/chart";
import { PLACE_INDEX } from "../fixtures/places";
import { CONFIG } from "./fixtures";

vi.mock("@/experimental/atproto/client", () => ({
  createTrialClient: vi.fn(),
}));
vi.mock("@/lib/places", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/places")>()),
  loadPlaceIndex: vi.fn(),
}));

const charts = {
  createSpace: vi.fn(),
  loadChart: vi.fn(),
  saveChart: vi.fn(),
  deleteChart: vi.fn(),
};
const client = {
  did: CONFIG.allowedDid,
  charts,
  signIn: vi.fn(),
  signOut: vi.fn(),
  dispose: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createTrialClient).mockResolvedValue(client);
  vi.mocked(loadPlaceIndex).mockResolvedValue(PLACE_INDEX);
  charts.createSpace.mockResolvedValue(CONFIG.space);
  charts.loadChart.mockResolvedValue(CHART.details);
  charts.saveChart.mockResolvedValue(undefined);
  charts.deleteChart.mockResolvedValue(undefined);
});

async function loadChart(): Promise<void> {
  await fireEvent.click(
    await screen.findByRole("button", {
      name: "Create my Aster Space",
    }),
  );
  await fireEvent.click(
    await screen.findByRole("button", {
      name: "Load my saved chart",
    }),
  );
  await screen.findByText("Loaded your saved chart.");
}

describe("personal trial UI", () => {
  it("creates a Space on request and uses its URI", async () => {
    render(TrialApp, { config: CONFIG });
    const button = await screen.findByRole("button", {
      name: "Create my Aster Space",
    });
    expect(charts.createSpace).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Date")).toBeNull();
    await fireEvent.click(button);
    expect(charts.createSpace).toHaveBeenCalledTimes(1);
    expect(screen.getByText(`Space: ${CONFIG.space}`)).toBeTruthy();
    expect(screen.getByLabelText("Date")).toBeTruthy();
  });
  it("allows retry after Space creation fails", async () => {
    charts.createSpace.mockRejectedValueOnce(new Error("Permission denied"));
    render(TrialApp, { config: CONFIG });
    const button = await screen.findByRole("button", {
      name: "Create my Aster Space",
    });
    await fireEvent.click(button);
    expect(screen.getByRole("alert").textContent).toContain(
      "Permission denied",
    );
    expect(screen.queryByLabelText("Date")).toBeNull();
    await fireEvent.click(button);
    expect(screen.getByLabelText("Date")).toBeTruthy();
  });
  it("requires an explicit save and defaults to omitting time", async () => {
    render(TrialApp, { config: CONFIG });
    await loadChart();
    expect(charts.saveChart).not.toHaveBeenCalled();
    await fireEvent.click(
      screen.getByLabelText(
        "These are my own details and I want to store them in my Space",
      ),
    );
    await fireEvent.click(
      screen.getByRole("button", { name: "Save my chart" }),
    );
    expect(charts.saveChart).toHaveBeenCalledWith(
      expect.objectContaining({ date: CHART.details.date }),
      TimeDisclosure.Omit,
    );
    expect(
      screen
        .getByRole("link", { name: "Open my saved chart in Aster" })
        .getAttribute("href"),
    ).toContain("time=unknown");
  });
  it("preserves loaded AI preferences when saving the form", async () => {
    const aiPreferences = {
      training: { allow: false, updatedAt: "2026-11-13T12:00:00Z" },
    };
    charts.loadChart.mockResolvedValue({ ...CHART.details, aiPreferences });
    render(TrialApp, { config: CONFIG });
    await loadChart();
    await fireEvent.click(
      screen.getByLabelText(
        "These are my own details and I want to store them in my Space",
      ),
    );
    await fireEvent.click(
      screen.getByRole("button", { name: "Save my chart" }),
    );
    expect(charts.saveChart).toHaveBeenCalledWith(
      expect.objectContaining({ aiPreferences }),
      TimeDisclosure.Omit,
    );
  });

  it("includes time only when explicitly selected", async () => {
    render(TrialApp, { config: CONFIG });
    await loadChart();
    await fireEvent.click(
      screen.getByLabelText(
        "These are my own details and I want to store them in my Space",
      ),
    );
    await fireEvent.click(
      screen.getByLabelText("Include my birth time in the saved record"),
    );
    await fireEvent.click(
      screen.getByRole("button", { name: "Save my chart" }),
    );
    expect(charts.saveChart).toHaveBeenCalledWith(
      expect.objectContaining({ time: CHART.details.time }),
      TimeDisclosure.Include,
    );
  });
  it("requires confirmation of whose details are saved", async () => {
    render(TrialApp, { config: CONFIG });
    await loadChart();
    await fireEvent.click(
      screen.getByRole("button", { name: "Save my chart" }),
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Confirm these are your own",
    );
    expect(charts.saveChart).not.toHaveBeenCalled();
  });
  it("surfaces storage errors and supports explicit deletion", async () => {
    render(TrialApp, { config: CONFIG });
    await loadChart();
    charts.deleteChart.mockRejectedValueOnce(new Error("Space unavailable"));
    await fireEvent.click(
      screen.getByRole("button", {
        name: "Delete my saved chart",
      }),
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Space unavailable",
    );
    await fireEvent.click(
      screen.getByRole("button", {
        name: "Delete my saved chart",
      }),
    );
    expect(
      screen.queryByRole("link", { name: "Open my saved chart in Aster" }),
    ).toBeNull();
  });
  it("clears loaded birth details when signing out", async () => {
    render(TrialApp, { config: CONFIG });
    await loadChart();
    await fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(client.signOut).toHaveBeenCalled();
    expect(screen.queryByLabelText("Date")).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Open my saved chart in Aster" }),
    ).toBeNull();
  });
  it("keeps birth entry disabled after OAuth failure", async () => {
    vi.mocked(createTrialClient).mockRejectedValue(new Error("OAuth failed"));
    render(TrialApp, { config: CONFIG });
    await screen.findByText("OAuth failed");
    expect(screen.queryByLabelText("Date")).toBeNull();
    await fireEvent.click(
      screen.getByRole("button", {
        name: "Sign in to my trial account",
      }),
    );
    expect(screen.getByRole("alert").textContent).toContain("OAuth failed");
  });
});
