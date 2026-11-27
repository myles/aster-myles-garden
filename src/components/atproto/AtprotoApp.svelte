<script lang="ts">
  import { onMount } from "svelte";

  import ChartForm, {
    type ChartInput,
  } from "@/components/atproto/ChartForm.svelte";
  import { ChartOwner } from "@/components/atproto/owner";
  import { Stage } from "@/components/atproto/stage";
  import Alert from "@/components/ui/Alert.svelte";
  import Button from "@/components/ui/Button.svelte";
  import ButtonRow from "@/components/ui/ButtonRow.svelte";
  import Field from "@/components/ui/Field.svelte";
  import FormPanel from "@/components/ui/FormPanel.svelte";
  import Input from "@/components/ui/Input.svelte";
  import Select from "@/components/ui/Select.svelte";
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
  // False in the server-rendered page, so it works without JavaScript.
  let isHydrated = $state(false);
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

  // What the view says in the stages that have no chart to draw.
  const PLACEHOLDERS: Partial<Record<Stage, string>> = {
    [Stage.Connecting]: "Loading your chart…",
    [Stage.SignedOut]: "Sign in to see your saved chart.",
    [Stage.Unavailable]: "Your chart couldn't be loaded.",
    [Stage.FirstSave]: "Save your birth details to draw your chart.",
  };

  onMount(() => {
    isHydrated = true;
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

<main class="grid flex-1 gap-8 lg:grid-cols-[20rem_1fr]">
  <div class="flex min-w-0 flex-col gap-6 self-start">
    <Alert message={error} />
    {#if status}
      <p role="status" class="text-ink-muted text-sm">{status}</p>
    {/if}

    {#if stage === Stage.SignedOut || !isHydrated}
      <FormPanel title="Sign in" onsubmit={signIn}>
        {#snippet description()}
          With your Bluesky or other AT Protocol handle.
        {/snippet}
        {#if !isHydrated}
          <p class="text-ink-muted text-sm">
            JavaScript is required to sign in and load your chart.
          </p>
        {/if}
        <fieldset
          disabled={isBusy || !isHydrated}
          class="m-0 flex min-w-0 flex-col gap-5 border-0 p-0"
        >
          <Field id="atproto-handle" label="Your handle">
            <Input
              id="atproto-handle"
              bind:value={handle}
              required
              autocomplete="username"
              autocapitalize="none"
              spellcheck="false"
              placeholder="you.bsky.social"
            />
          </Field>
          <ButtonRow>
            <Button variant="primary" type="submit">Sign in</Button>
          </ButtonRow>
        </fieldset>
      </FormPanel>
    {:else if stage === Stage.Unavailable}
      <section class="ui-panel">
        <ButtonRow>
          <Button variant="primary" disabled={isBusy} onclick={openChart}>
            Try again
          </Button>
        </ButtonRow>
      </section>
    {:else if stage === Stage.Viewing}
      <section class="ui-panel" aria-labelledby="atproto-yours">
        <h2 id="atproto-yours" class="ui-heading-section">Your chart</h2>
        <ButtonRow>
          <Button
            size="small"
            disabled={isBusy}
            onclick={() => openStage(Stage.Editing)}
          >
            Edit my details
          </Button>
          <Button variant="quiet" disabled={isBusy} onclick={deleteOwnChart}>
            Delete my saved chart
          </Button>
        </ButtonRow>
      </section>

      <section class="ui-panel" aria-labelledby="atproto-people">
        <h2 id="atproto-people" class="ui-heading-section">People</h2>
        {#if peopleError}
          <Alert message={peopleError} />
          <ButtonRow>
            <Button size="small" disabled={isBusy} onclick={loadPeople}>
              Try again
            </Button>
          </ButtonRow>
        {/if}
        {#if people.length > 0}
          <Field id="atproto-compare-with" label="Compare with">
            <Select
              id="atproto-compare-with"
              disabled={isBusy}
              bind:value={selectedRkey}
            >
              {#each people as person (person.rkey)}
                <option value={person.rkey}>{person.details.name}</option>
              {/each}
            </Select>
          </Field>
        {:else if !peopleError}
          <p class="ui-hint">Add someone to compare your chart with theirs.</p>
        {/if}
        {#if selectedPerson}
          <ButtonRow>
            <Button
              size="small"
              disabled={isBusy}
              onclick={() => openStage(Stage.EditingPerson)}
            >
              Edit {selectedPerson.details.name}
            </Button>
            <Button
              variant="quiet"
              disabled={isBusy}
              onclick={() => removePerson(selectedPerson)}
            >
              Remove {selectedPerson.details.name}
            </Button>
          </ButtonRow>
        {/if}
        <ButtonRow>
          <Button
            size="small"
            disabled={isBusy}
            onclick={() => openStage(Stage.AddingPerson)}
          >
            Add someone
          </Button>
        </ButtonRow>
      </section>
    {:else if stage === Stage.FirstSave || stage === Stage.Editing}
      <ChartForm
        owner={ChartOwner.Self}
        title="My birth details"
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
        title={stage === Stage.EditingPerson && selectedPerson
          ? `Edit ${selectedPerson.details.name}'s details`
          : "Add someone"}
        initial={stage === Stage.EditingPerson
          ? selectedPerson?.details
          : undefined}
        {isBusy}
        onsave={savePerson}
        oncancel={() => openStage(Stage.Viewing)}
      />
    {/if}

    {#if stage !== Stage.SignedOut && stage !== Stage.Connecting}
      <p class="text-ink-muted flex flex-wrap items-center gap-x-2 text-sm">
        Signed in.
        <Button variant="quiet" disabled={isBusy} onclick={signOut}>
          Sign out
        </Button>
      </p>
    {/if}
  </div>

  <div class="min-w-0">
    {#if comparison && stage !== Stage.FirstSave}
      <ComparisonView synastry={comparison} />
    {:else if savedChart && stage !== Stage.FirstSave}
      <ChartView chart={savedChart} />
    {:else}
      <div
        class="border-rule text-ink-muted flex h-full min-h-80 items-center justify-center rounded-lg border border-dashed p-8 text-center"
      >
        {PLACEHOLDERS[isHydrated ? stage : Stage.SignedOut]}
      </div>
    {/if}
  </div>
</main>
