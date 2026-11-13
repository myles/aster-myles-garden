<!-- Birth form and chart view. Talks to the chart service, place search
     and wheel renderer — never to the ephemeris. Once your chart is drawn,
     a second form compares it with someone else's. -->
<script lang="ts">
  import BirthFields from "@/components/BirthFields.svelte";
  import ChartView from "@/components/ChartView.svelte";
  import ComparisonView from "@/components/ComparisonView.svelte";
  import {
    createChart,
    loadChartEngine,
    type BirthDetails,
    type Chart,
  } from "@/lib/chart";
  import { describeError } from "@/lib/format";
  import {
    DEFAULT_HOUSE_SYSTEM,
    HOUSE_SYSTEM_NAMES,
    HouseSystem,
    isHouseSystem,
  } from "@/lib/houses";
  import { findPlace, loadPlaceIndex, type Place } from "@/lib/places";
  import { parseShareHash, type SharedPerson } from "@/lib/share";
  import { compareCharts } from "@/lib/synastry";
  import { parseLocalDate, parseLocalTime } from "@/lib/time";
  import { onMount, tick } from "svelte";

  /** One person's form fields. */
  type BirthForm = {
    date: string;
    time: string;
    isTimeUnknown: boolean;
    place?: Place;
  };

  const COMPARE_DATE_ID = "compare-date";

  const houseSystems = Object.values(HouseSystem);

  let yours: BirthForm = $state(createBlankForm());
  let theirs: BirthForm = $state(createBlankForm());
  let houseSystem: string = $state(DEFAULT_HOUSE_SYSTEM);
  let chart: Chart | undefined = $state.raw();
  let comparedChart: Chart | undefined = $state.raw();
  let isComparing = $state(false);
  let error = $state("");
  let compareError = $state("");
  let isDrawing = $state(false);
  let hasRequestedEngine = false;

  const synastry = $derived(
    chart && comparedChart ? compareCharts(chart, comparedChart) : undefined,
  );

  // Houses are only hidden when no chart on screen could have them.
  const isHouseSystemUnused = $derived(
    yours.isTimeUnknown && (!isComparing || theirs.isTimeUnknown),
  );

  // Pasting another share link only changes the hash, which doesn't
  // reload the page, so listen for that too.
  onMount(() => {
    const onHashChange = () => void openSharedLink();

    void openSharedLink();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  });

  function createBlankForm(): BirthForm {
    return { date: "", time: "", isTimeUnknown: false, place: undefined };
  }

  // Fills in the forms from a share link, then draws its chart, and the
  // comparison when the link carries a second chart.
  async function openSharedLink(): Promise<void> {
    try {
      const shared = parseShareHash(window.location.hash);
      if (!shared) {
        return;
      }

      requestEngine();
      houseSystem = shared.houseSystem;
      yours = await fillForm(shared);

      if (shared.comparedWith) {
        theirs = await fillForm(shared.comparedWith);
        isComparing = true;
      } else {
        stopComparing();
      }
    } catch (cause) {
      error = `Couldn't open the shared link: ${describeError(cause)}`;
      return;
    }

    await draw();
    if (isComparing) {
      await compare();
    }
  }

  async function fillForm(person: SharedPerson): Promise<BirthForm> {
    const place = findPlace(await loadPlaceIndex(), person.placeId);
    if (!place) {
      throw new Error(`No place has the ID ${person.placeId}.`);
    }

    return {
      date: person.date,
      time: person.time ?? "",
      isTimeUnknown: person.time === undefined,
      place,
    };
  }

  // Start fetching the WASM engine as soon as someone engages a form.
  function requestEngine(): void {
    if (hasRequestedEngine) {
      return;
    }

    hasRequestedEngine = true;
    loadChartEngine().catch((cause: unknown) => {
      error = `Couldn't load the calculator: ${describeError(cause)}`;
    });
  }

  /** Why a form can't be drawn yet, or undefined when it's ready. */
  function findProblem(form: BirthForm): string | undefined {
    const isTimeMissing = !form.time && !form.isTimeUnknown;

    if (!form.date && isTimeMissing) {
      return "Enter both a date and a time.";
    }
    if (!form.date) {
      return "Enter a date.";
    }
    if (isTimeMissing) {
      return "Enter a time, or tick “I don't know the time”.";
    }
    if (!form.place) {
      return "Choose a place from the list.";
    }
    return undefined;
  }

  /** Call only once findProblem has passed the form. */
  function toDetails(form: BirthForm, system: HouseSystem): BirthDetails {
    return {
      date: parseLocalDate(form.date),
      time: form.isTimeUnknown ? undefined : parseLocalTime(form.time),
      place: form.place!,
      houseSystem: system,
    };
  }

  async function draw(): Promise<void> {
    const problem = findProblem(yours);
    if (problem) {
      error = problem;
      return;
    }
    if (!isHouseSystem(houseSystem)) {
      error = "Choose a house system.";
      return;
    }

    error = "";
    isDrawing = true;

    try {
      await loadChartEngine();
      chart = createChart(toDetails(yours, houseSystem));
      // Both charts share the house system, so a drawn comparison follows.
      if (comparedChart) {
        comparedChart = createChart(toDetails(theirs, houseSystem));
      }
    } catch (cause) {
      error = `Couldn't draw the chart: ${describeError(cause)}`;
    } finally {
      isDrawing = false;
    }
  }

  async function compare(): Promise<void> {
    const problem = findProblem(theirs);
    if (problem) {
      compareError = problem;
      return;
    }
    if (!chart || !isHouseSystem(houseSystem)) {
      compareError = "Draw your own chart first.";
      return;
    }

    compareError = "";
    isDrawing = true;

    try {
      await loadChartEngine();
      comparedChart = createChart(toDetails(theirs, houseSystem));
    } catch (cause) {
      compareError = `Couldn't draw their chart: ${describeError(cause)}`;
    } finally {
      isDrawing = false;
    }
  }

  async function startComparing(): Promise<void> {
    isComparing = true;
    await tick();
    document.getElementById(COMPARE_DATE_ID)?.focus();
  }

  function stopComparing(): void {
    isComparing = false;
    comparedChart = undefined;
    compareError = "";
  }

  function onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    void draw();
  }

  function onCompareSubmit(event: SubmitEvent): void {
    event.preventDefault();
    void compare();
  }

  // Changing the house system or whether a time is known redraws what's
  // already on screen.
  function redrawIfDrawn(): void {
    if (chart) {
      void draw();
    }
  }

  function recompareIfCompared(): void {
    if (comparedChart) {
      void compare();
    }
  }
</script>

<main class="grid flex-1 gap-8 lg:grid-cols-[20rem_1fr]">
  <div class="flex flex-col gap-6 self-start">
    <form
      aria-label="Your birth details"
      class="border-rule bg-panel flex flex-col gap-5 rounded-lg border p-5"
      novalidate
      onfocusin={requestEngine}
      onsubmit={onSubmit}
    >
      <BirthFields
        idPrefix="birth"
        timeHint="Local clock time where you were born."
        bind:date={yours.date}
        bind:time={yours.time}
        bind:isTimeUnknown={yours.isTimeUnknown}
        bind:place={yours.place}
        onTimeUnknownChange={redrawIfDrawn}
      />

      <div class="flex flex-col gap-1.5">
        <label for="house-system" class="text-sm font-medium">
          House system
        </label>
        <select
          id="house-system"
          name="houseSystem"
          class="border-rule bg-paper rounded border px-3 py-2 disabled:opacity-50"
          bind:value={houseSystem}
          disabled={isHouseSystemUnused}
          onchange={redrawIfDrawn}
        >
          {#each houseSystems as system (system)}
            <option value={system}>{HOUSE_SYSTEM_NAMES[system]}</option>
          {/each}
        </select>
        {#if isHouseSystemUnused}
          <p class="text-ink-muted text-xs">Houses need a birth time.</p>
        {/if}
      </div>

      <button
        type="submit"
        class="bg-accent text-paper rounded px-4 py-2 font-medium hover:opacity-90 disabled:opacity-50"
        disabled={isDrawing}
      >
        Draw chart
      </button>

      <p
        role="alert"
        class="text-sm text-[var(--challenging)]"
        hidden={error.length === 0}
      >
        {error}
      </p>
    </form>

    {#if chart && !isComparing}
      <button
        type="button"
        class="border-rule bg-panel hover:bg-accent/10 focus-visible:outline-accent rounded-lg border px-4 py-2.5 font-medium focus-visible:outline-2"
        onclick={startComparing}
      >
        Compare with someone else
      </button>
    {/if}

    {#if isComparing}
      <form
        aria-label="Their birth details"
        class="border-rule bg-panel flex flex-col gap-5 rounded-lg border p-5"
        novalidate
        onfocusin={requestEngine}
        onsubmit={onCompareSubmit}
      >
        <div>
          <h2 class="font-serif text-lg">Compare with someone else</h2>
          <p class="text-ink-muted text-xs">
            Their chart uses your house system.
          </p>
        </div>

        <BirthFields
          idPrefix="compare"
          timeHint="Local clock time where they were born."
          bind:date={theirs.date}
          bind:time={theirs.time}
          bind:isTimeUnknown={theirs.isTimeUnknown}
          bind:place={theirs.place}
          onTimeUnknownChange={recompareIfCompared}
        />

        <div class="flex flex-wrap gap-2">
          <button
            type="submit"
            class="bg-accent text-paper rounded px-4 py-2 font-medium hover:opacity-90 disabled:opacity-50"
            disabled={isDrawing}
          >
            Compare charts
          </button>
          <button
            type="button"
            class="border-rule hover:bg-accent/10 rounded border px-4 py-2"
            onclick={stopComparing}
          >
            Stop comparing
          </button>
        </div>

        <p
          role="alert"
          class="text-sm text-[var(--challenging)]"
          hidden={compareError.length === 0}
        >
          {compareError}
        </p>
      </form>
    {/if}
  </div>

  <section aria-live="polite" class="min-w-0">
    {#if synastry}
      <ComparisonView {synastry} />
    {:else if chart}
      <ChartView {chart} />
    {:else}
      <div
        class="border-rule text-ink-muted flex h-full min-h-80 items-center justify-center rounded-lg border border-dashed p-8 text-center"
      >
        Enter a date, time and place to draw a chart.
      </div>
    {/if}
  </section>
</main>
