<script lang="ts">
  import { onMount } from "svelte";

  import BirthFields from "@/components/BirthFields.svelte";
  import { describeError } from "@/lib/format";
  import {
    DEFAULT_HOUSE_SYSTEM,
    HOUSE_SYSTEM_NAMES,
    HouseSystem,
  } from "@/lib/houses";
  import type { Place } from "@/lib/places";
  import { buildShareUrl } from "@/lib/share";
  import {
    formatDateValue,
    formatTimeValue,
    parseLocalDate,
    parseLocalTime,
  } from "@/lib/time";

  import { createTrialClient, type TrialClient } from "./client";
  import type { TrialConfig } from "./config";
  import { TimeDisclosure, type ChartDetails } from "./record";

  let { config }: { config: TrialConfig } = $props();
  let connection: TrialClient | undefined = $state.raw();
  let date = $state("");
  let time = $state("");
  let place: Place | undefined = $state.raw();
  let isTimeUnknown = $state(false);
  let houseSystem = $state(DEFAULT_HOUSE_SYSTEM);
  let shouldIncludeTime = $state(false);
  let hasConfirmedOwnership = $state(false);
  let isBusy = $state(true);
  let error = $state("");
  let status = $state("");
  let space = $state("");
  let savedDetails: ChartDetails | undefined = $state.raw();

  onMount(() => {
    let isMounted = true;
    void createTrialClient(config).then(
      (client) => {
        if (!isMounted) {
          void client.dispose();
          return undefined;
        }
        connection = client;
        isBusy = false;
        return undefined;
      },
      (cause: unknown) => {
        error = describeError(cause);
        isBusy = false;
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

  async function signIn(): Promise<void> {
    await runAction(async () => {
      connection ??= await createTrialClient(config);
      await connection.signIn();
    });
  }

  async function signOut(): Promise<void> {
    await runAction(async () => {
      await connection?.signOut();
      await connection?.dispose();
      connection = undefined;
      savedDetails = undefined;
      space = "";
      date = "";
      time = "";
      place = undefined;
      hasConfirmedOwnership = false;
      status = "Signed out.";
    });
  }

  async function createSpace(): Promise<void> {
    await runAction(async () => {
      if (!connection?.charts) {
        throw new Error("Sign in first.");
      }
      space = await connection.charts.createSpace();
      status = "Your personal Aster Space is ready.";
    });
  }

  async function loadSavedChart(): Promise<void> {
    await runAction(async () => {
      if (!connection?.charts) {
        throw new Error("Sign in first.");
      }
      savedDetails = await connection.charts.loadChart();
      if (!savedDetails) {
        status = "No Aster chart is saved in this Space.";
        return;
      }
      date = formatDateValue(savedDetails.date);
      time = savedDetails.time ? formatTimeValue(savedDetails.time) : "";
      isTimeUnknown = !savedDetails.time;
      place = savedDetails.place;
      houseSystem = savedDetails.houseSystem;
      status = "Loaded your saved chart.";
    });
  }

  async function saveChart(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    await runAction(async () => {
      if (!connection?.charts) {
        throw new Error("Sign in first.");
      }
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
      await connection.charts.saveChart(details, disclosure);
      savedDetails = {
        ...details,
        time: shouldIncludeTime ? details.time : undefined,
      };
      status = "Saved your chart in your Space.";
    });
  }

  async function deleteChart(): Promise<void> {
    await runAction(async () => {
      if (!connection?.charts) {
        throw new Error("Sign in first.");
      }
      await connection.charts.deleteChart();
      savedDetails = undefined;
      status = "Deleted your saved chart from the Space.";
    });
  }
</script>

<main class="mx-auto max-w-2xl px-4 py-8">
  <h1 class="font-serif text-3xl">Aster · personal AT Protocol trial</h1>
  <p class="mt-3">
    This experiment saves only your own chart in your configured Space. Your PDS
    and apps or people with Space access can read it. It is not end-to-end
    encrypted. Use test details during the alpha.
  </p>
  <p class="text-ink-muted mt-2 text-sm">
    This trial has no friend discovery and never publishes to your public repo.
  </p>

  {#if isBusy}
    <p role="status" class="mt-4">Connecting…</p>
  {/if}
  <p role="alert" hidden={!error} class="mt-4">{error}</p>
  <p role="status" class="mt-4">{status}</p>

  {#if connection?.did}
    <p class="mt-4 text-sm break-all">Signed in as {connection.did}</p>
    {#if !space}
      <button
        type="button"
        disabled={isBusy}
        onclick={createSpace}
        class="bg-accent text-paper mt-4 rounded px-4 py-2"
      >
        Create my Aster Space
      </button>
      <p class="mt-2 text-sm">
        If your personal Aster Space already exists, this opens it instead.
      </p>
    {:else}
      <p class="mt-2 text-sm break-all">Space: {space}</p>
    {/if}
    <fieldset disabled={isBusy} class="mt-4 flex flex-wrap gap-3">
      <button
        type="button"
        disabled={!space}
        class="underline"
        onclick={loadSavedChart}
      >
        Load my saved chart
      </button>
      <button
        type="button"
        disabled={!space}
        class="underline"
        onclick={deleteChart}
      >
        Delete my saved chart
      </button>
      <button type="button" class="underline" onclick={signOut}>
        Sign out
      </button>
    </fieldset>
    {#if space}
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
          <button type="submit" class="bg-accent text-paper rounded px-4 py-2">
            Save my chart
          </button>
        </fieldset>
      </form>
    {/if}
  {:else}
    <button
      type="button"
      disabled={isBusy}
      onclick={signIn}
      class="bg-accent text-paper mt-6 rounded px-4 py-2"
    >
      Sign in to my trial account
    </button>
  {/if}

  {#if savedDetails}
    <p class="mt-6">
      <a class="underline" href={buildShareUrl(savedDetails, config.origin)}>
        Open my saved chart in Aster
      </a>
    </p>
  {/if}
  <p class="mt-8"><a href="/" class="underline">Back to Aster</a></p>
</main>
