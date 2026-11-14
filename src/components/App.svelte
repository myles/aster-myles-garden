<!-- Birth form and chart view. Talks to the chart service, place search
     and wheel renderer — never to the ephemeris. Once your chart is drawn,
     a second form compares it with someone else's or shows its transits. -->
<script lang="ts">
  import BirthFields from "@/components/BirthFields.svelte";
  import ChartView from "@/components/ChartView.svelte";
  import ComparisonView from "@/components/ComparisonView.svelte";
  import TransitView from "@/components/TransitView.svelte";
  import { Panel } from "@/components/panel";
  import SaveChartRow from "@/components/SaveChartRow.svelte";
  import SavedChartList from "@/components/SavedChartList.svelte";
  import {
    canCalculateDate,
    canCalculateMoment,
    createChart,
    LAST_CALCULABLE_DATE_VALUE,
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
  import {
    addSavedChart,
    getBrowserStorage,
    readSavedCharts,
    removeSavedChart,
    type SavedChart,
  } from "@/lib/saved-charts";
  import { parseShareHash, type SharedPerson } from "@/lib/share";
  import { compareCharts } from "@/lib/synastry";
  import {
    formatDateValue,
    formatTimeValue,
    getLocalTimeZone,
    parseLocalDate,
    parseLocalDateTime,
    parseLocalTime,
    toLocal,
    toUtc,
  } from "@/lib/time";
  import { createTransits } from "@/lib/transits";
  import { onMount, tick } from "svelte";

  /** One person's form fields. */
  type BirthForm = {
    date: string;
    time: string;
    isTimeUnknown: boolean;
    place?: Place;
  };

  const COMPARE_DATE_ID = "compare-date";
  const TRANSIT_DATE_ID = "transit-date";

  // Below Tailwind's lg breakpoint the layout stacks: forms, then result.
  const STACKED_LAYOUT_QUERY = "(width < 64rem)";

  // The span the calculation engine covers, as people are told it.
  const CALCULABLE_SPAN = "about 3000 BCE to 3000 CE";
  const BIRTH_OUT_OF_RANGE = `Charts can only be drawn for dates from ${CALCULABLE_SPAN}.`;
  const TRANSITS_OUT_OF_RANGE = `Transits can only be shown from ${CALCULABLE_SPAN}.`;

  const houseSystems = Object.values(HouseSystem);

  let yours: BirthForm = $state(createBlankForm());
  let theirs: BirthForm = $state(createBlankForm());
  let houseSystem: string = $state(DEFAULT_HOUSE_SYSTEM);
  let chart: Chart | undefined = $state.raw();
  let comparedChart: Chart | undefined = $state.raw();
  // Cast so TypeScript doesn't narrow panel to its first value, None.
  let panel = $state(Panel.None as Panel);
  // Transit moments are read on the clock where the visitor is.
  let transitTimeZone = $state("UTC");
  let transitDate = $state("");
  let transitTime = $state("");
  let transitsAt: Date | undefined = $state.raw();
  let transitError = $state("");
  let savedCharts: SavedChart[] = $state.raw([]);
  // Why saved charts can't be used, e.g. the browser blocks storage.
  let savedChartsError = $state("");
  let error = $state("");
  let compareError = $state("");
  let isDrawing = $state(false);
  let isHydrated = $state(false);
  let hasRequestedEngine = false;
  let result: HTMLElement | undefined = $state();

  const synastry = $derived(
    panel === Panel.Comparison && chart && comparedChart
      ? compareCharts(chart, comparedChart)
      : undefined,
  );

  // The engine is loaded whenever a chart exists, and transitsAt is
  // checked against its range, but a calculation can still throw. Caught
  // here, it's reported in the transit form instead of breaking the page.
  const transitResult = $derived.by(() => {
    if (panel !== Panel.Transits || !chart || !transitsAt) {
      return undefined;
    }

    try {
      return { transits: createTransits(chart, transitsAt) };
    } catch (cause) {
      return { failure: `Couldn't show transits: ${describeError(cause)}` };
    }
  });
  const transits = $derived(transitResult?.transits);
  const transitAlert = $derived(transitError || transitResult?.failure || "");

  // Houses are only hidden when no chart on screen could have them.
  const isHouseSystemUnused = $derived(
    yours.isTimeUnknown && (panel !== Panel.Comparison || theirs.isTimeUnknown),
  );

  // Pasting another share link only changes the hash, which doesn't
  // reload the page, so listen for that too.
  onMount(() => {
    isHydrated = true;

    const onHashChange = () => void openSharedLink();

    transitTimeZone = getLocalTimeZone();
    loadSavedCharts();
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

      closePanel();
      if (shared.comparedWith) {
        theirs = await fillForm(shared.comparedWith);
        panel = Panel.Comparison;
      }
      if (shared.transitsAt) {
        setTransitMoment(shared.transitsAt);
        panel = Panel.Transits;
      }
    } catch (cause) {
      error = `Couldn't open the shared link: ${describeError(cause)}`;
      return;
    }

    await draw();
    if (panel === Panel.Comparison) {
      await compare();
    }
  }

  async function fillForm(person: SharedPerson): Promise<BirthForm> {
    return {
      date: person.date,
      time: person.time ?? "",
      isTimeUnknown: person.time === undefined,
      place: await resolvePlace(person),
    };
  }

  /** A place entered by coordinates comes whole; a listed one is looked up. */
  async function resolvePlace(person: SharedPerson): Promise<Place> {
    if ("place" in person) {
      return person.place;
    }

    const place = findPlace(await loadPlaceIndex(), person.placeId);
    if (!place) {
      throw new Error(`No place has the ID ${person.placeId}.`);
    }
    return place;
  }

  function loadSavedCharts(): void {
    try {
      savedCharts = readSavedCharts(getBrowserStorage());
    } catch (cause) {
      savedChartsError = describeError(cause);
    }
  }

  /** Saves a form under a name; returns why it couldn't, or undefined. */
  function saveForm(form: BirthForm, name: string): string | undefined {
    const problem = findProblem(form);
    if (problem) {
      return problem;
    }

    try {
      savedCharts = addSavedChart(getBrowserStorage(), {
        name,
        date: form.date,
        time: form.isTimeUnknown ? undefined : form.time,
        place: form.place!,
      });
      return undefined;
    } catch (cause) {
      return describeError(cause);
    }
  }

  function forgetSavedChart(saved: SavedChart): void {
    try {
      savedCharts = removeSavedChart(getBrowserStorage(), saved.id);
      savedChartsError = "";
    } catch (cause) {
      savedChartsError = describeError(cause);
    }
  }

  function toForm(saved: SavedChart): BirthForm {
    return {
      date: saved.date,
      time: saved.time ?? "",
      isTimeUnknown: saved.time === undefined,
      place: saved.place,
    };
  }

  // Using a saved chart fills the form and draws it straight away.
  function useSavedForYou(saved: SavedChart): void {
    yours = toForm(saved);
    void draw();
  }

  function useSavedForThem(saved: SavedChart): void {
    theirs = toForm(saved);
    void compare();
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
      return "Choose a place from the list, or enter its coordinates.";
    }
    return undefined;
  }

  function isCalculable(details: BirthDetails): boolean {
    return canCalculateDate(details.date, details.place.timeZone);
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

  /** Draws your chart, and theirs when comparing; true once both show. */
  async function draw(): Promise<boolean> {
    error = findProblem(yours) ?? "";
    compareError = comparedChart ? (findProblem(theirs) ?? "") : "";
    if (error || compareError) {
      return false;
    }
    if (!isHouseSystem(houseSystem)) {
      error = "Choose a house system.";
      return false;
    }

    error = "";
    isDrawing = true;

    try {
      const yourDetails = toDetails(yours, houseSystem);
      const theirDetails = comparedChart
        ? toDetails(theirs, houseSystem)
        : undefined;
      if (!isCalculable(yourDetails)) {
        error = BIRTH_OUT_OF_RANGE;
        return false;
      }
      if (theirDetails && !isCalculable(theirDetails)) {
        compareError = BIRTH_OUT_OF_RANGE;
        return false;
      }

      await loadChartEngine();
      const nextChart = createChart(yourDetails);
      const nextComparedChart = theirDetails
        ? createChart(theirDetails)
        : undefined;

      // Publish both results only after every calculation succeeds.
      chart = nextChart;
      comparedChart = nextComparedChart;
      return true;
    } catch (cause) {
      error = `Couldn't draw the chart: ${describeError(cause)}`;
      return false;
    } finally {
      isDrawing = false;
    }
  }

  /** Draws the comparison; true once both charts show. */
  async function compare(): Promise<boolean> {
    const problem = findProblem(theirs);
    if (problem) {
      compareError = problem;
      return false;
    }
    if (!chart || !isHouseSystem(houseSystem)) {
      compareError = "Draw your own chart first.";
      return false;
    }

    error = findProblem(yours) ?? "";
    if (error) {
      return false;
    }

    compareError = "";
    isDrawing = true;

    try {
      const yourDetails = toDetails(yours, houseSystem);
      const theirDetails = toDetails(theirs, houseSystem);
      if (!isCalculable(yourDetails)) {
        error = BIRTH_OUT_OF_RANGE;
        return false;
      }
      if (!isCalculable(theirDetails)) {
        compareError = BIRTH_OUT_OF_RANGE;
        return false;
      }

      await loadChartEngine();
      const nextChart = createChart(yourDetails);
      const nextComparedChart = createChart(theirDetails);

      // A retry may follow a failed house-system change: rebuild both.
      chart = nextChart;
      comparedChart = nextComparedChart;
      return true;
    } catch (cause) {
      compareError = `Couldn't draw their chart: ${describeError(cause)}`;
      return false;
    } finally {
      isDrawing = false;
    }
  }

  async function openPanel(next: Panel, focusId: string): Promise<void> {
    panel = next;
    await tick();
    document.getElementById(focusId)?.focus();
  }

  function startComparing(): Promise<void> {
    return openPanel(Panel.Comparison, COMPARE_DATE_ID);
  }

  /** Opens transits for right now. */
  function startTransits(): Promise<void> {
    setTransitMoment(new Date());
    return openPanel(Panel.Transits, TRANSIT_DATE_ID);
  }

  /** Back to your chart alone, forgetting any comparison or transits. */
  function closePanel(): void {
    panel = Panel.None;
    comparedChart = undefined;
    compareError = "";
    transitsAt = undefined;
    transitError = "";
  }

  /** Shows transits for a moment and puts it in the transit form. */
  function setTransitMoment(at: Date): void {
    const local = toLocal(at, transitTimeZone);
    transitDate = formatDateValue(local);
    transitTime = formatTimeValue(local);

    // A share link can carry any moment, so it's checked like typed ones.
    if (!canCalculateMoment(at)) {
      transitsAt = undefined;
      transitError = TRANSITS_OUT_OF_RANGE;
      return;
    }

    transitsAt = at;
    transitError = "";
  }

  function showTransits(): void {
    if (!transitDate || !transitTime) {
      transitError = "Enter both a date and a time.";
      return;
    }

    try {
      const local = parseLocalDateTime(transitDate, transitTime);
      const at = toUtc(local, transitTimeZone);
      if (!canCalculateMoment(at)) {
        transitError = TRANSITS_OUT_OF_RANGE;
        return;
      }

      transitsAt = at;
      transitError = "";
    } catch (cause) {
      transitError = `Couldn't show transits: ${describeError(cause)}`;
    }
  }

  function onTransitSubmit(event: SubmitEvent): void {
    event.preventDefault();
    showTransits();
  }

  /**
   * On a stacked layout, the result sits below the forms, often out of
   * sight after a submission. Moving focus to its heading brings it into
   * view and tells screen readers where it went. Beside the form, as on a
   * wide screen, it's already visible, so focus stays put.
   */
  async function revealResult(): Promise<void> {
    if (!window.matchMedia(STACKED_LAYOUT_QUERY).matches) {
      return;
    }

    await tick();
    const heading = result?.querySelector("h2");
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: "start" });
  }

  async function onSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (await draw()) {
      await revealResult();
    }
  }

  async function onCompareSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (await compare()) {
      await revealResult();
    }
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
      {#if !isHydrated}
        <p class="text-ink-muted text-sm">
          JavaScript is required to calculate your chart in your browser. Enable
          it to enter your birth details.
        </p>
      {/if}
      <!-- Disable inputs and submit buttons together so native clicks and
           Enter cannot submit birth details before hydration. -->
      <fieldset
        class="m-0 flex min-w-0 flex-col gap-5 border-0 p-0"
        disabled={!isHydrated}
      >
        <SavedChartList
          charts={savedCharts}
          onUse={useSavedForYou}
          onForget={forgetSavedChart}
        />

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

        <SaveChartRow
          idPrefix="birth"
          blockedReason={savedChartsError || undefined}
          onSave={(name) => saveForm(yours, name)}
        />
      </fieldset>
    </form>

    {#if chart && panel === Panel.None}
      <div class="flex flex-col gap-2">
        <button
          type="button"
          class="border-rule bg-panel hover:bg-accent/10 focus-visible:outline-accent rounded-lg border px-4 py-2.5 font-medium focus-visible:outline-2"
          onclick={startComparing}
        >
          Compare with someone else
        </button>
        <button
          type="button"
          class="border-rule bg-panel hover:bg-accent/10 focus-visible:outline-accent rounded-lg border px-4 py-2.5 font-medium focus-visible:outline-2"
          onclick={startTransits}
        >
          See transits
        </button>
      </div>
    {/if}

    {#if panel === Panel.Transits}
      <form
        aria-label="Transit moment"
        class="border-rule bg-panel flex flex-col gap-5 rounded-lg border p-5"
        novalidate
        onsubmit={onTransitSubmit}
      >
        <div>
          <h2 class="font-serif text-lg">Transit moment</h2>
          <p class="text-ink-muted text-xs">
            The sky at this moment, against your chart. Times are in your time
            zone, {transitTimeZone}.
          </p>
        </div>

        <div class="flex flex-col gap-1.5">
          <label for={TRANSIT_DATE_ID} class="text-sm font-medium">Date</label>
          <input
            id={TRANSIT_DATE_ID}
            name="transitDate"
            type="date"
            required
            min="0001-01-01"
            max={LAST_CALCULABLE_DATE_VALUE}
            class="border-rule bg-paper rounded border px-3 py-2"
            bind:value={transitDate}
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="transit-time" class="text-sm font-medium">Time</label>
          <input
            id="transit-time"
            name="transitTime"
            type="time"
            required
            class="border-rule bg-paper rounded border px-3 py-2"
            bind:value={transitTime}
          />
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="submit"
            class="bg-accent text-paper rounded px-4 py-2 font-medium hover:opacity-90"
          >
            Show transits
          </button>
          <button
            type="button"
            class="border-rule hover:bg-accent/10 rounded border px-4 py-2"
            onclick={() => setTransitMoment(new Date())}
          >
            Now
          </button>
          <button
            type="button"
            class="border-rule hover:bg-accent/10 rounded border px-4 py-2"
            onclick={closePanel}
          >
            Back to your chart
          </button>
        </div>

        <p
          role="alert"
          class="text-sm text-[var(--challenging)]"
          hidden={transitAlert.length === 0}
        >
          {transitAlert}
        </p>
      </form>
    {/if}

    {#if panel === Panel.Comparison}
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

        <SavedChartList
          charts={savedCharts}
          onUse={useSavedForThem}
          onForget={forgetSavedChart}
        />

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
            onclick={closePanel}
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

        <SaveChartRow
          idPrefix="compare"
          blockedReason={savedChartsError || undefined}
          onSave={(name) => saveForm(theirs, name)}
        />
      </form>
    {/if}
  </div>

  <section aria-live="polite" class="min-w-0" bind:this={result}>
    {#if synastry}
      <ComparisonView {synastry} />
    {:else if transits}
      <TransitView {transits} timeZone={transitTimeZone} />
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
