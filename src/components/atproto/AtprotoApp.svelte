<script lang="ts">
  import { onMount } from "svelte";

  import BirthFields from "@/components/birth-form/BirthFields.svelte";
  import { Stage } from "@/components/atproto/stage";
  import ChartView from "@/components/views/ChartView.svelte";
  import { describeError } from "@/lib/format";
  import {
    DEFAULT_HOUSE_SYSTEM,
    HOUSE_SYSTEM_NAMES,
    HouseSystem,
  } from "@/lib/astrology/houses";
  import { createChart, loadChartEngine, type Chart } from "@/lib/charts/chart";
  import type { Place } from "@/lib/places";
  import {
    formatDateValue,
    formatTimeValue,
    parseLocalDate,
    parseLocalTime,
  } from "@/lib/time";

  import {
    createAtprotoClient,
    type AtprotoClient,
  } from "@/lib/atproto/client";
  import { TimeDisclosure, type ChartDetails } from "@/lib/atproto/record";

  let connection: AtprotoClient | undefined = $state.raw();
  let stage: Stage = $state(Stage.Connecting);
  let handle = $state("");
  let date = $state("");
  let time = $state("");
  let place: Place | undefined = $state.raw();
  let isTimeUnknown = $state(false);
  let houseSystem = $state(DEFAULT_HOUSE_SYSTEM);
  let shouldIncludeTime = $state(false);
  let hasConfirmedOwnership = $state(false);
  let isBusy = $state(false);
  let error = $state("");
  let status = $state("");
  let space = $state("");
  let savedDetails: ChartDetails | undefined = $state.raw();
  let savedChart: Chart | undefined = $state.raw();

  onMount(() => {
    let isMounted = true;
    void createAtprotoClient(window.location.href).then(
      (client) => {
        if (!isMounted) {
          void client.dispose();
          return undefined;
        }
        connection = client;
        if (!client.charts) {
          stage = Stage.SignedOut;
          return undefined;
        }
        void openChart();
        return undefined;
      },
      (cause: unknown) => {
        error = describeError(cause);
        stage = Stage.SignedOut;
        return undefined;
      },
    );
    return () => {
      isMounted = false;
      void connection?.dispose();
    };
  });

  async function runAction(action: () => Promise<void>): Promise<void> {
    isBusy = true;
    error = "";
    status = "";
    try {
      await action();
    } catch (cause) {
      error = describeError(cause);
    } finally {
      isBusy = false;
    }
  }

  function requireCharts(): NonNullable<AtprotoClient["charts"]> {
    if (!connection?.charts) {
      throw new Error("Sign in first.");
    }
    return connection.charts;
  }

  async function signIn(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    await runAction(async () => {
      connection ??= await createAtprotoClient(window.location.href);
      await connection.signIn(handle.trim());
    });
  }

  async function signOut(): Promise<void> {
    await runAction(async () => {
      await connection?.signOut();
      await connection?.dispose();
      connection = undefined;
      savedDetails = undefined;
      savedChart = undefined;
      space = "";
      fillForm(undefined);
      stage = Stage.SignedOut;
      status = "Signed out.";
    });
  }

  // The Space and chart persist on the PDS, so a resumed session shows them.
  async function openChart(): Promise<void> {
    stage = Stage.Connecting;
    await runAction(async () => {
      try {
        const charts = requireCharts();
        space = (await charts.findSpace()) ?? "";
        await showChart(space ? await charts.loadChart() : undefined);
      } catch (cause) {
        stage = Stage.Unavailable;
        throw cause;
      }
    });
  }

  // Cast from what's stored, so an omitted birth time draws as unknown.
  async function showChart(details: ChartDetails | undefined): Promise<void> {
    if (!details) {
      savedDetails = undefined;
      savedChart = undefined;
      fillForm(undefined);
      stage = Stage.FirstSave;
      return;
    }
    await loadChartEngine();
    savedChart = createChart(details);
    savedDetails = details;
    stage = Stage.Viewing;
  }

  function fillForm(details: ChartDetails | undefined): void {
    date = details ? formatDateValue(details.date) : "";
    time = details?.time ? formatTimeValue(details.time) : "";
    isTimeUnknown = details ? !details.time : false;
    place = details?.place;
    houseSystem = details?.houseSystem ?? DEFAULT_HOUSE_SYSTEM;
    shouldIncludeTime = false;
    hasConfirmedOwnership = false;
  }

  function startEditing(): void {
    fillForm(savedDetails);
    error = "";
    status = "";
    stage = Stage.Editing;
  }

  function cancelEditing(): void {
    error = "";
    stage = Stage.Viewing;
  }

  async function saveChart(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    await runAction(async () => {
      const charts = requireCharts();
      if (!hasConfirmedOwnership) {
        throw new Error("Confirm these are your own birth details.");
      }
      if (!place) {
        throw new Error("Choose a place or enter its coordinates.");
      }
      const details: ChartDetails = {
        ...(savedDetails?.aiPreferences !== undefined
          ? { aiPreferences: savedDetails.aiPreferences }
          : {}),
        date: parseLocalDate(date),
        time: isTimeUnknown ? undefined : parseLocalTime(time),
        place,
        houseSystem,
      };
      const disclosure = shouldIncludeTime
        ? TimeDisclosure.Include
        : TimeDisclosure.Omit;

      // A first save also creates the personal Space it's kept in.
      space ||= await charts.createSpace();
      await charts.saveChart(details, disclosure);
      await showChart({
        ...details,
        time: shouldIncludeTime ? details.time : undefined,
      });
      status = "Saved your chart in your Space.";
    });
  }

  async function deleteChart(): Promise<void> {
    await runAction(async () => {
      await requireCharts().deleteChart();
      await showChart(undefined);
      status = "Deleted your saved chart from the Space.";
    });
  }
</script>

<main class="mx-auto max-w-6xl px-4 py-8">
  <div class="mx-auto max-w-2xl">
    <h1 class="font-serif text-3xl">Your chart on AT Protocol</h1>
    {#if stage === Stage.Viewing}
      <p class="text-ink-muted mt-2 text-sm">
        Saved in your personal Space. Not end-to-end encrypted.
      </p>
    {:else}
      <p class="mt-3">
        Save your own chart in a personal Space on your AT Protocol account.
        Your PDS and apps or people with Space access can read it. It is not
        end-to-end encrypted. Spaces are in alpha, so use test details for now.
      </p>
      <p class="text-ink-muted mt-2 text-sm">
        Aster never publishes your chart to your public repo.
      </p>
    {/if}

    <p role="alert" hidden={!error} class="mt-4">{error}</p>
    <p role="status" class="mt-4">
      {stage === Stage.Connecting ? "Loading your chart…" : status}
    </p>

    {#if stage === Stage.SignedOut}
      <form onsubmit={signIn} class="mt-6">
        <fieldset disabled={isBusy} class="flex flex-col gap-3">
          <label class="flex flex-col gap-2">
            Your handle
            <input
              type="text"
              bind:value={handle}
              required
              autocomplete="username"
              autocapitalize="none"
              spellcheck="false"
              placeholder="you.bsky.social"
              class="rounded border p-2"
            />
          </label>
          <button
            type="submit"
            class="bg-accent text-paper self-start rounded px-4 py-2"
          >
            Sign in
          </button>
        </fieldset>
      </form>
    {:else if stage !== Stage.Connecting}
      <p class="mt-4 text-sm break-all">Signed in as {connection?.did}</p>
      <fieldset disabled={isBusy} class="mt-4 flex flex-wrap gap-3">
        {#if stage === Stage.Viewing}
          <button type="button" class="underline" onclick={startEditing}>
            Edit my details
          </button>
          <button type="button" class="underline" onclick={deleteChart}>
            Delete my saved chart
          </button>
        {:else if stage === Stage.Unavailable}
          <button type="button" class="underline" onclick={openChart}>
            Try again
          </button>
        {/if}
        <button type="button" class="underline" onclick={signOut}>
          Sign out
        </button>
      </fieldset>
    {/if}

    {#if stage === Stage.FirstSave || stage === Stage.Editing}
      <form onsubmit={saveChart} class="mt-6">
        <fieldset disabled={isBusy} class="flex min-w-0 flex-col gap-5">
          <legend class="mb-4 font-serif text-xl">My birth details</legend>
          <BirthFields
            idPrefix="atproto"
            timeHint="Local birth time. Omitted from the record by default."
            bind:date
            bind:time
            bind:isTimeUnknown
            bind:place
          />
          <label class="flex flex-col gap-2">
            House system
            <select bind:value={houseSystem} class="rounded border p-2">
              {#each Object.values(HouseSystem) as system (system)}
                <option value={system}>{HOUSE_SYSTEM_NAMES[system]}</option>
              {/each}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              bind:checked={shouldIncludeTime}
              disabled={isTimeUnknown}
            />
            Include my birth time in the saved record
          </label>
          <label>
            <input type="checkbox" bind:checked={hasConfirmedOwnership} />
            These are my own details and I want to store them in my Space
          </label>
          {#if !space}
            <p class="text-ink-muted text-sm">
              Saving creates a personal Aster Space on your account.
            </p>
          {/if}
          <div class="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              class="bg-accent text-paper rounded px-4 py-2"
            >
              Save my chart
            </button>
            {#if stage === Stage.Editing}
              <button type="button" class="underline" onclick={cancelEditing}>
                Cancel
              </button>
            {/if}
          </div>
        </fieldset>
      </form>
    {/if}
  </div>

  {#if stage === Stage.Viewing && savedChart}
    <section class="border-rule mt-10 border-t pt-8">
      <ChartView chart={savedChart} />
    </section>
  {/if}
  <p class="mx-auto mt-8 max-w-2xl">
    <a href="/" class="underline">Back to Aster</a>
  </p>
</main>
