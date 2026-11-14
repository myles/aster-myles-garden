<!-- Birth form and chart view. Talks to the chart service, place search
     and wheel renderer — never to the ephemeris. Once your chart is drawn,
     a second form compares it with someone else's or shows its transits,
     progressions or solar return. -->
<script lang="ts">
  import BirthFields from "@/components/birth-form/BirthFields.svelte";
  import PlaceFields from "@/components/birth-form/PlaceFields.svelte";
  import { Panel } from "@/components/panel";
  import SaveChartRow from "@/components/saved-charts/SaveChartRow.svelte";
  import SavedChartList from "@/components/saved-charts/SavedChartList.svelte";
  import ChartView from "@/components/views/ChartView.svelte";
  import ComparisonView from "@/components/views/ComparisonView.svelte";
  import CompositeView from "@/components/views/CompositeView.svelte";
  import ProgressionView from "@/components/views/ProgressionView.svelte";
  import SolarReturnView from "@/components/views/SolarReturnView.svelte";
  import TransitView from "@/components/views/TransitView.svelte";
  import {
    ASPECT_SET_NAMES,
    AspectSet,
    DEFAULT_ASPECT_SETTINGS,
    ORB_SIZE_NAMES,
    OrbSize,
  } from "@/lib/astrology/aspects";
  import {
    canCalculateDate,
    canCalculateMoment,
    createChart,
    LAST_CALCULABLE_DATE_VALUE,
    loadChartEngine,
    type BirthDetails,
    type Chart,
  } from "@/lib/charts/chart";
  import { describeError } from "@/lib/format";
  import {
    DEFAULT_HOUSE_SYSTEM,
    HOUSE_SYSTEM_NAMES,
    HouseSystem,
    isHouseSystem,
  } from "@/lib/astrology/houses";
  import { findPlace, loadPlaceIndex, type Place } from "@/lib/places";
  import { readPreferences, writePreferences } from "@/lib/storage/preferences";
  import {
    addSavedChart,
    getBrowserStorage,
    readSavedCharts,
    removeSavedChart,
    type SavedChart,
  } from "@/lib/storage/saved-charts";
  import {
    parseShareHash,
    type SharedPerson,
    type SharedPlace,
  } from "@/lib/share";
  import {
    createSolarReturn,
    findCurrentReturnYear,
    SolarReturnStyle,
  } from "@/lib/charts/solar-return";
  import { createComposite } from "@/lib/charts/composite";
  import {
    compareCharts,
    COMPARISON_STYLE_NAMES,
    ComparisonStyle,
  } from "@/lib/charts/synastry";
  import {
    formatDateValue,
    formatTimeValue,
    getLocalTimeZone,
    parseLocalDate,
    parseLocalDateTime,
    parseLocalTime,
    toLocal,
    toUtc,
    type LocalDate,
  } from "@/lib/time";
  import { createProgressions } from "@/lib/charts/progressions";
  import { createTransits } from "@/lib/charts/transits";
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
  const PROGRESSIONS_DATE_ID = "progressions-date";
  const RETURN_YEAR_ID = "return-year";

  const RETURN_NEEDS_TIME =
    "A solar return needs your birth time. Enter it above and draw your " +
    "chart again.";

  // Below Tailwind's lg breakpoint the layout stacks: forms, then result.
  const STACKED_LAYOUT_QUERY = "(width < 64rem)";

  // The span the calculation engine covers, as people are told it.
  const CALCULABLE_SPAN = "about 3000 BCE to 3000 CE";
  const BIRTH_OUT_OF_RANGE = `Charts can only be drawn for dates from ${CALCULABLE_SPAN}.`;
  const TRANSITS_OUT_OF_RANGE = `Transits can only be shown from ${CALCULABLE_SPAN}.`;

  const houseSystems = Object.values(HouseSystem);
  const aspectSets = Object.values(AspectSet);
  const orbSizes = Object.values(OrbSize);
  const comparisonStyles = Object.values(ComparisonStyle);

  let yours: BirthForm = $state(createBlankForm());
  let theirs: BirthForm = $state(createBlankForm());
  let houseSystem: string = $state(DEFAULT_HOUSE_SYSTEM);
  let aspectSet = $state(DEFAULT_ASPECT_SETTINGS.aspectSet);
  let orbSize = $state(DEFAULT_ASPECT_SETTINGS.orbSize);
  let chart: Chart | undefined = $state.raw();
  let comparedChart: Chart | undefined = $state.raw();
  let comparisonStyle = $state(ComparisonStyle.BiWheel);
  // Cast so TypeScript doesn't narrow panel to its first value, None.
  let panel = $state(Panel.None as Panel);
  // Transit moments are read on the clock where the visitor is.
  let transitTimeZone = $state("UTC");
  let transitDate = $state("");
  let transitTime = $state("");
  let transitsAt: Date | undefined = $state.raw();
  let transitError = $state("");
  // The form's date, and the date shown, set when the form is submitted.
  let progressionsDate = $state("");
  let progressionsForDate: LocalDate | undefined = $state.raw();
  let progressionsError = $state("");
  let returnStyle = $state(SolarReturnStyle.Standalone);
  // A number input binds a number, or null while it's empty.
  let returnYear: number | null = $state(null);
  let returnPlace: Place | undefined = $state.raw();
  // The year and place shown, set when the form is submitted.
  let shownReturn: { year: number; place: Place } | undefined = $state.raw();
  let returnError = $state("");
  let savedCharts: SavedChart[] = $state.raw([]);
  // Why saved charts can't be used, e.g. the browser blocks storage.
  let savedChartsError = $state("");
  // Why chart settings can't be remembered, or the saved ones read.
  let settingsNote = $state("");
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

  // Like transits below, a composite casts houses of its own, which can
  // throw; the failure is reported in their form, over the bi-wheel.
  const compositeResult = $derived.by(() => {
    if (!synastry || comparisonStyle !== ComparisonStyle.Composite) {
      return undefined;
    }

    try {
      return { composite: createComposite(synastry.first, synastry.second) };
    } catch (cause) {
      return {
        failure: `Couldn't draw the composite: ${describeError(cause)}`,
      };
    }
  });
  const composite = $derived(compositeResult?.composite);
  const compareAlert = $derived(compareError || compositeResult?.failure || "");

  // Finding a return can throw, e.g. for a year the engine can't reach.
  // Caught here, it's reported in the return form, as transits are.
  const solarReturnResult = $derived.by(() => {
    if (panel !== Panel.SolarReturn || !chart || !shownReturn) {
      return undefined;
    }

    try {
      const { year, place } = shownReturn;
      return { solarReturn: createSolarReturn(chart, year, place) };
    } catch (cause) {
      return {
        failure: `Couldn't find the solar return: ${describeError(cause)}`,
      };
    }
  });
  const solarReturn = $derived(solarReturnResult?.solarReturn);
  const returnAlert = $derived(returnError || solarReturnResult?.failure || "");

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

  // A date before the birth throws, and is reported in the form.
  const progressionsResult = $derived.by(() => {
    if (panel !== Panel.Progressions || !chart || !progressionsForDate) {
      return undefined;
    }

    try {
      return { progressions: createProgressions(chart, progressionsForDate) };
    } catch (cause) {
      return {
        failure: `Couldn't show progressions: ${describeError(cause)}`,
      };
    }
  });
  const progressions = $derived(progressionsResult?.progressions);
  const progressionsAlert = $derived(
    progressionsError || progressionsResult?.failure || "",
  );

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
    loadPreferences();
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
      ({ aspectSet, orbSize } = shared.aspectSettings);
      yours = await fillForm(shared);

      closePanel();
      if (shared.comparedWith) {
        theirs = await fillForm(shared.comparedWith);
        comparisonStyle = shared.comparisonStyle ?? ComparisonStyle.BiWheel;
        panel = Panel.Comparison;
      }
      if (shared.solarReturn) {
        const { year, place } = shared.solarReturn;
        // No place in the link means the birthplace.
        const resolved = place ? await resolvePlace(place) : yours.place!;
        returnStyle = shared.solarReturn.style ?? SolarReturnStyle.Standalone;
        returnYear = year;
        returnPlace = resolved;
        shownReturn = { year, place: resolved };
        panel = Panel.SolarReturn;
      }
      if (shared.transitsAt) {
        setTransitMoment(shared.transitsAt);
        panel = Panel.Transits;
      }
      if (shared.progressionsForDate) {
        setProgressionsDate(shared.progressionsForDate);
        panel = Panel.Progressions;
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
  async function resolvePlace(shared: SharedPlace): Promise<Place> {
    if ("place" in shared) {
      return shared.place;
    }

    const place = findPlace(await loadPlaceIndex(), shared.placeId);
    if (!place) {
      throw new Error(`No place has the ID ${shared.placeId}.`);
    }
    return place;
  }

  // Before any share link opens, so the link's settings win.
  function loadPreferences(): void {
    try {
      const saved = readPreferences(getBrowserStorage());
      if (!saved) {
        return;
      }

      houseSystem = saved.houseSystem;
      ({ aspectSet, orbSize } = saved.aspectSettings);
    } catch (cause) {
      settingsNote =
        "Couldn't read your saved settings, so the defaults are in use: " +
        describeError(cause);
    }
  }

  // Only what's chosen here is saved: a share link's settings are shown
  // without replacing yours.
  function savePreferences(): void {
    if (!isHouseSystem(houseSystem)) {
      return;
    }

    try {
      writePreferences(getBrowserStorage(), {
        houseSystem,
        aspectSettings: { aspectSet, orbSize },
      });
      settingsNote = "";
    } catch (cause) {
      settingsNote = `Couldn't remember your settings: ${describeError(cause)}`;
    }
  }

  function onSettingChange(): void {
    savePreferences();
    redrawIfDrawn();
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
      aspectSettings: { aspectSet, orbSize },
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

  /** Opens progressions for today, on the visitor's clock. */
  function startProgressions(): Promise<void> {
    setProgressionsDate(toLocal(new Date(), transitTimeZone));
    return openPanel(Panel.Progressions, PROGRESSIONS_DATE_ID);
  }

  /**
   * Opens the solar return in effect now, cast at the birthplace. Without
   * a birth time, it opens on why there isn't one.
   */
  function startSolarReturn(): Promise<void> {
    returnStyle = SolarReturnStyle.Standalone;
    returnPlace = chart?.details.place;
    shownReturn = undefined;
    returnError = "";

    if (!chart?.details.time) {
      returnYear = null;
      returnError = RETURN_NEEDS_TIME;
      return openPanel(Panel.SolarReturn, RETURN_YEAR_ID);
    }

    try {
      const year = findCurrentReturnYear(chart, new Date());
      returnYear = year;
      shownReturn = { year, place: chart.details.place };
    } catch (cause) {
      returnError = `Couldn't find the solar return: ${describeError(cause)}`;
    }
    return openPanel(Panel.SolarReturn, RETURN_YEAR_ID);
  }

  function showSolarReturn(): void {
    if (!chart?.details.time) {
      returnError = RETURN_NEEDS_TIME;
      return;
    }
    if (returnYear === null || !Number.isInteger(returnYear)) {
      returnError = "Enter a year, such as 2026.";
      return;
    }
    if (!returnPlace) {
      returnError = "Choose a place from the list, or enter its coordinates.";
      return;
    }

    shownReturn = { year: returnYear, place: returnPlace };
    returnError = "";
  }

  function onReturnSubmit(event: SubmitEvent): void {
    event.preventDefault();
    showSolarReturn();
  }

  /** Back to your chart alone, forgetting whatever was added to it. */
  function closePanel(): void {
    panel = Panel.None;
    comparedChart = undefined;
    comparisonStyle = ComparisonStyle.BiWheel;
    compareError = "";
    transitsAt = undefined;
    transitError = "";
    progressionsForDate = undefined;
    progressionsError = "";
    shownReturn = undefined;
    returnError = "";
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

  /** Shows progressions for a date and puts it in the form. */
  function setProgressionsDate({ year, month, day }: LocalDate): void {
    const forDate = { year, month, day };
    progressionsDate = formatDateValue(forDate);
    progressionsForDate = forDate;
    progressionsError = "";
  }

  function showProgressions(): void {
    if (!progressionsDate) {
      progressionsError = "Enter a date.";
      return;
    }

    try {
      progressionsForDate = parseLocalDate(progressionsDate);
      progressionsError = "";
    } catch (cause) {
      progressionsError = `Couldn't show progressions: ${describeError(cause)}`;
    }
  }

  function onProgressionsSubmit(event: SubmitEvent): void {
    event.preventDefault();
    showProgressions();
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

  // Changing the house system, the aspect settings or whether a time is
  // known redraws what's already on screen.
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
            onchange={onSettingChange}
          >
            {#each houseSystems as system (system)}
              <option value={system}>{HOUSE_SYSTEM_NAMES[system]}</option>
            {/each}
          </select>
          {#if isHouseSystemUnused}
            <p class="text-ink-muted text-xs">Houses need a birth time.</p>
          {/if}
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label for="aspect-set" class="text-sm font-medium">Aspects</label>
            <select
              id="aspect-set"
              name="aspectSet"
              class="border-rule bg-paper rounded border px-3 py-2"
              bind:value={aspectSet}
              onchange={onSettingChange}
            >
              {#each aspectSets as set (set)}
                <option value={set}>{ASPECT_SET_NAMES[set]}</option>
              {/each}
            </select>
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="orb-size" class="text-sm font-medium">Orbs</label>
            <select
              id="orb-size"
              name="orbSize"
              class="border-rule bg-paper rounded border px-3 py-2"
              bind:value={orbSize}
              onchange={onSettingChange}
            >
              {#each orbSizes as size (size)}
                <option value={size}>{ORB_SIZE_NAMES[size]}</option>
              {/each}
            </select>
          </div>
        </div>
        {#if settingsNote}
          <p class="text-ink-muted -mt-3 text-xs">{settingsNote}</p>
        {/if}

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
        <button
          type="button"
          class="border-rule bg-panel hover:bg-accent/10 focus-visible:outline-accent rounded-lg border px-4 py-2.5 font-medium focus-visible:outline-2"
          onclick={startProgressions}
        >
          See progressions
        </button>
        <button
          type="button"
          class="border-rule bg-panel hover:bg-accent/10 focus-visible:outline-accent rounded-lg border px-4 py-2.5 font-medium focus-visible:outline-2"
          onclick={startSolarReturn}
        >
          See solar return
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

    {#if panel === Panel.Progressions}
      <form
        aria-label="Progressed date"
        class="border-rule bg-panel flex flex-col gap-5 rounded-lg border p-5"
        novalidate
        onsubmit={onProgressionsSubmit}
      >
        <div>
          <h2 class="font-serif text-lg">Progressed date</h2>
          <p class="text-ink-muted text-xs">
            Your chart moved on a day for each year of life, to this date.
          </p>
        </div>

        <div class="flex flex-col gap-1.5">
          <label for={PROGRESSIONS_DATE_ID} class="text-sm font-medium">
            Date
          </label>
          <input
            id={PROGRESSIONS_DATE_ID}
            name="progressionsDate"
            type="date"
            required
            min={chart ? formatDateValue(chart.details.date) : undefined}
            max={LAST_CALCULABLE_DATE_VALUE}
            class="border-rule bg-paper rounded border px-3 py-2"
            bind:value={progressionsDate}
          />
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="submit"
            class="bg-accent text-paper rounded px-4 py-2 font-medium hover:opacity-90"
          >
            Show progressions
          </button>
          <button
            type="button"
            class="border-rule hover:bg-accent/10 rounded border px-4 py-2"
            onclick={() =>
              setProgressionsDate(toLocal(new Date(), transitTimeZone))}
          >
            Today
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
          hidden={progressionsAlert.length === 0}
        >
          {progressionsAlert}
        </p>
      </form>
    {/if}

    {#if panel === Panel.SolarReturn}
      <form
        aria-label="Solar return"
        class="border-rule bg-panel flex flex-col gap-5 rounded-lg border p-5"
        novalidate
        onsubmit={onReturnSubmit}
      >
        <div>
          <h2 class="font-serif text-lg">Solar return</h2>
          <p class="text-ink-muted text-xs">
            The chart for the moment the Sun gets back to where it was when you
            were born, cast for where you are on that birthday.
          </p>
        </div>

        <div class="flex flex-col gap-1.5">
          <label for={RETURN_YEAR_ID} class="text-sm font-medium">Year</label>
          <input
            id={RETURN_YEAR_ID}
            name="returnYear"
            type="number"
            inputmode="numeric"
            required
            min="1"
            max="3002"
            step="1"
            class="border-rule bg-paper rounded border px-3 py-2"
            bind:value={returnYear}
          />
        </div>

        <PlaceFields idPrefix="return" bind:place={returnPlace} />

        <div class="flex flex-wrap gap-2">
          <button
            type="submit"
            class="bg-accent text-paper rounded px-4 py-2 font-medium hover:opacity-90"
          >
            Show solar return
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
          hidden={returnAlert.length === 0}
        >
          {returnAlert}
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

        <fieldset class="flex flex-col gap-1.5">
          <legend class="text-sm font-medium">Show</legend>
          <div class="flex gap-4">
            {#each comparisonStyles as style (style)}
              <label class="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="comparisonStyle"
                  value={style}
                  bind:group={comparisonStyle}
                />
                {COMPARISON_STYLE_NAMES[style]}
              </label>
            {/each}
          </div>
        </fieldset>

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
          hidden={compareAlert.length === 0}
        >
          {compareAlert}
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
    {#if composite}
      <CompositeView {composite} />
    {:else if synastry}
      <ComparisonView {synastry} />
    {:else if transits}
      <TransitView {transits} timeZone={transitTimeZone} />
    {:else if progressions}
      <ProgressionView {progressions} />
    {:else if solarReturn}
      <SolarReturnView {solarReturn} bind:style={returnStyle} />
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
