<script lang="ts">
  import { onMount } from "svelte";

  import ChartForm, {
    type ChartInput,
  } from "@/components/atproto/ChartForm.svelte";
  import { ChartOwner } from "@/components/atproto/owner";
  import { Stage } from "@/components/atproto/stage";
  import ChartView from "@/components/views/ChartView.svelte";
  import ComparisonView from "@/components/views/ComparisonView.svelte";
  import { describeError } from "@/lib/format";
  import { createChart, loadChartEngine, type Chart } from "@/lib/charts/chart";
  import { compareCharts } from "@/lib/charts/synastry";

  import {
    createAtprotoClient,
    type AtprotoClient,
  } from "@/lib/atproto/client";
  import { TimeDisclosure, type ChartDetails } from "@/lib/atproto/record";
  import type { PersonChart } from "@/lib/atproto/store";

  /** Someone saved in the Space, with their chart already cast. */
  type ComparedPerson = PersonChart & { chart: Chart };

  let connection: AtprotoClient | undefined = $state.raw();
  let stage: Stage = $state(Stage.Connecting);
  let handle = $state("");
  let isBusy = $state(false);
  let error = $state("");
  let status = $state("");
  let space = $state("");
  let savedDetails: ChartDetails | undefined = $state.raw();
  let savedChart: Chart | undefined = $state.raw();
  let people: ComparedPerson[] = $state.raw([]);
  let selectedRkey = $state("");
  let peopleError = $state("");

  const selectedPerson = $derived(
    people.find(({ rkey }) => rkey === selectedRkey),
  );
  const comparison = $derived(
    savedChart && selectedPerson
      ? compareCharts(savedChart, selectedPerson.chart)
      : undefined,
  );

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

  /** What a record holds after saving: a withheld time is dropped. */
  function toStored({ details, disclosure }: ChartInput): ChartDetails {
    return disclosure === TimeDisclosure.Include
      ? details
      : { ...details, time: undefined };
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
      people = [];
      selectedRkey = "";
      peopleError = "";
      space = "";
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
      if (savedDetails) {
        await loadPeople();
      }
    });
  }

  // Cast from what's stored, so an omitted birth time draws as unknown.
  async function showChart(details: ChartDetails | undefined): Promise<void> {
    if (!details) {
      savedDetails = undefined;
      savedChart = undefined;
      stage = Stage.FirstSave;
      return;
    }
    await loadChartEngine();
    savedChart = createChart(details);
    savedDetails = details;
    stage = Stage.Viewing;
  }

  // People fail on their own, so your chart stays on screen regardless.
  async function loadPeople(): Promise<void> {
    peopleError = "";
    try {
      const listed = await requireCharts().listPeople();
      await loadChartEngine();
      people = listed.map((person) => ({
        ...person,
        chart: createChart(person.details),
      }));
      if (!selectedPerson) {
        selectedRkey = people[0]?.rkey ?? "";
      }
    } catch (cause) {
      peopleError = describeError(cause);
    }
  }

  function openStage(next: Stage): void {
    error = "";
    status = "";
    stage = next;
  }

  function saveOwnChart(read: () => ChartInput): void {
    void runAction(async () => {
      const charts = requireCharts();
      const input = read();

      // A first save also creates the personal Space it's kept in.
      space ||= await charts.createSpace();
      await charts.saveChart(input.details, input.disclosure);
      await showChart(toStored(input));
      status = "Saved your chart in your Space.";
      await loadPeople();
    });
  }

  function savePerson(read: () => ChartInput): void {
    void runAction(async () => {
      const charts = requireCharts();
      const input = read();
      const details = toStored(input);
      let rkey: string;
      if (stage === Stage.EditingPerson) {
        // Never fall back to adding: that would duplicate the person.
        if (!selectedPerson) {
          throw new Error("Choose who to edit first.");
        }
        rkey = selectedPerson.rkey;
        await charts.savePerson(rkey, input.details, input.disclosure);
      } else {
        rkey = await charts.addPerson(input.details, input.disclosure);
      }
      await loadChartEngine();
      const saved = { rkey, details, chart: createChart(details) };
      people = [...people.filter((person) => person.rkey !== rkey), saved];
      selectedRkey = rkey;
      stage = Stage.Viewing;
      status = `Saved ${details.name}'s chart in your Space.`;
    });
  }

  async function deleteOwnChart(): Promise<void> {
    await runAction(async () => {
      await requireCharts().deleteChart();
      await showChart(undefined);
      status = "Deleted your saved chart from the Space.";
    });
  }

  async function removePerson(person: ComparedPerson): Promise<void> {
    await runAction(async () => {
      await requireCharts().deletePerson(person.rkey);
      people = people.filter(({ rkey }) => rkey !== person.rkey);
      selectedRkey = people[0]?.rkey ?? "";
      status = `Removed ${person.details.name}'s chart from the Space.`;
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
        Save your own chart, and the charts of people you compare it with, in a
        personal Space on your AT Protocol account. Your PDS and apps or people
        with Space access can read it. It is not end-to-end encrypted. Spaces
        are in alpha, so use test details for now.
      </p>
      <p class="text-ink-muted mt-2 text-sm">
        Aster never publishes your charts to your public repo.
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
          <button
            type="button"
            class="underline"
            onclick={() => openStage(Stage.Editing)}
          >
            Edit my details
          </button>
          <button type="button" class="underline" onclick={deleteOwnChart}>
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

    {#if stage === Stage.Viewing}
      <section aria-labelledby="atproto-people" class="mt-8">
        <h2 id="atproto-people" class="font-serif text-xl">
          Compare your chart
        </h2>
        {#if peopleError}
          <p role="alert" class="mt-2">{peopleError}</p>
          <button type="button" class="mt-2 underline" onclick={loadPeople}>
            Try again
          </button>
        {/if}
        <fieldset disabled={isBusy} class="mt-3 flex flex-wrap items-end gap-3">
          {#if people.length > 0}
            <label class="flex flex-col gap-2">
              Compare with
              <select bind:value={selectedRkey} class="rounded border p-2">
                {#each people as person (person.rkey)}
                  <option value={person.rkey}>{person.details.name}</option>
                {/each}
              </select>
            </label>
          {/if}
          {#if selectedPerson}
            <button
              type="button"
              class="underline"
              onclick={() => openStage(Stage.EditingPerson)}
            >
              Edit {selectedPerson.details.name}
            </button>
            <button
              type="button"
              class="underline"
              onclick={() => removePerson(selectedPerson)}
            >
              Remove {selectedPerson.details.name}
            </button>
          {/if}
          <button
            type="button"
            class="underline"
            onclick={() => openStage(Stage.AddingPerson)}
          >
            Add someone
          </button>
        </fieldset>
        {#if people.length === 0 && !peopleError}
          <p class="text-ink-muted mt-2 text-sm">
            Add someone to compare your chart with theirs.
          </p>
        {/if}
      </section>
    {/if}

    {#if stage === Stage.FirstSave || stage === Stage.Editing}
      <ChartForm
        owner={ChartOwner.Self}
        initial={stage === Stage.Editing ? savedDetails : undefined}
        {isBusy}
        note={space
          ? undefined
          : "Saving creates a personal Aster Space on your account."}
        onsave={saveOwnChart}
        oncancel={stage === Stage.Editing
          ? () => openStage(Stage.Viewing)
          : undefined}
      />
    {:else if stage === Stage.AddingPerson || stage === Stage.EditingPerson}
      <ChartForm
        owner={ChartOwner.Person}
        initial={stage === Stage.EditingPerson
          ? selectedPerson?.details
          : undefined}
        {isBusy}
        onsave={savePerson}
        oncancel={() => openStage(Stage.Viewing)}
      />
    {/if}
  </div>

  {#if stage === Stage.Viewing && comparison}
    <section class="border-rule mt-10 border-t pt-8">
      <ComparisonView synastry={comparison} />
    </section>
  {:else if stage === Stage.Viewing && savedChart}
    <section class="border-rule mt-10 border-t pt-8">
      <ChartView chart={savedChart} />
    </section>
  {/if}
  <p class="mx-auto mt-8 max-w-2xl">
    <a href="/" class="underline">Back to Aster</a>
  </p>
</main>
