<!-- The page's state and how its parts fit together: your birth form,
     whatever panel is open beside it, and the result. Talks to the chart
     service, place search and storage — never to the ephemeris. The
     forms and views themselves live in panels/ and views/. -->
<script lang="ts">
  import {
    createBlankForm,
    type BirthForm,
  } from "@/components/birth-form/birth-form";
  import { Panel } from "@/components/panel";
  import AddToChartMenu from "@/components/panels/AddToChartMenu.svelte";
  import ChartSettingsFields from "@/components/panels/ChartSettingsFields.svelte";
  import ComparePanel from "@/components/panels/ComparePanel.svelte";
  import {
    COMPARE_DATE_ID,
    LUNAR_RETURN_DATE_ID,
    PROGRESSIONS_DATE_ID,
    RETURN_YEAR_ID,
    TRANSIT_DATE_ID,
  } from "@/components/panels/ids";
  import LunarReturnPanel from "@/components/panels/LunarReturnPanel.svelte";
  import ProgressionsPanel from "@/components/panels/ProgressionsPanel.svelte";
  import SolarReturnPanel from "@/components/panels/SolarReturnPanel.svelte";
  import TransitsPanel from "@/components/panels/TransitsPanel.svelte";
  import YourChartForm from "@/components/panels/YourChartForm.svelte";
  import { toAyanamsa, TROPICAL } from "@/components/panels/zodiac";
  import ChartResult from "@/components/views/ChartResult.svelte";
  import { DEFAULT_ASPECT_SETTINGS } from "@/lib/astrology/aspects";
  import {
    canCalculateDate,
    canCalculateMoment,
    createChart,
    loadChartEngine,
    type BirthDetails,
    type Chart,
  } from "@/lib/charts/chart";
  import { describeError } from "@/lib/format";
  import {
    DEFAULT_HOUSE_SYSTEM,
    type HouseSystem,
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
  } from "@/lib/charts/solar-return";
  import { createLunarReturn } from "@/lib/charts/lunar-return";
  import { ReturnStyle } from "@/lib/charts/returns";
  import { createComposite } from "@/lib/charts/composite";
  import { compareCharts, ComparisonStyle } from "@/lib/charts/synastry";
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

  const RETURN_NEEDS_TIME =
    "A solar return needs your birth time. Enter it above and draw your " +
    "chart again.";
  const LUNAR_RETURN_NEEDS_TIME =
    "A lunar return needs your birth time. Enter it above and draw your " +
    "chart again.";

  // Below Tailwind's lg breakpoint the layout stacks: forms, then result.
  const STACKED_LAYOUT_QUERY = "(width < 64rem)";

  // The span the calculation engine covers, as people are told it.
  const CALCULABLE_SPAN = "about 3000 BCE to 3000 CE";
  const BIRTH_OUT_OF_RANGE = `Charts can only be drawn for dates from ${CALCULABLE_SPAN}.`;
  const TRANSITS_OUT_OF_RANGE = `Transits can only be shown from ${CALCULABLE_SPAN}.`;

  let yours: BirthForm = $state(createBlankForm());
  let theirs: BirthForm = $state(createBlankForm());
  let houseSystem: string = $state(DEFAULT_HOUSE_SYSTEM);
  let aspectSet = $state(DEFAULT_ASPECT_SETTINGS.aspectSet);
  let orbSize = $state(DEFAULT_ASPECT_SETTINGS.orbSize);
  // TROPICAL, or the ayanamsa of a sidereal zodiac.
  let zodiac: string = $state(TROPICAL);
  const ayanamsa = $derived(toAyanamsa(zodiac));
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
  let returnStyle = $state(ReturnStyle.Standalone);
  // A number input binds a number, or null while it's empty.
  let returnYear: number | null = $state(null);
  let returnPlace: Place | undefined = $state.raw();
  // The year and place shown, set when the form is submitted.
  let shownReturn: { year: number; place: Place } | undefined = $state.raw();
  let returnError = $state("");
  let lunarReturnStyle = $state(ReturnStyle.Standalone);
  let lunarReturnDate = $state("");
  let lunarReturnPlace: Place | undefined = $state.raw();
  // The date and place shown, set when the form is submitted.
  let shownLunarReturn: { date: LocalDate; place: Place } | undefined =
    $state.raw();
  let lunarReturnError = $state("");
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

  // As with a solar return: a date before the first return, or one the
  // engine can't reach, throws, and is reported in the form.
  const lunarReturnResult = $derived.by(() => {
    if (panel !== Panel.LunarReturn || !chart || !shownLunarReturn) {
      return undefined;
    }

    try {
      const { date, place } = shownLunarReturn;
      return { lunarReturn: createLunarReturn(chart, date, place) };
    } catch (cause) {
      return {
        failure: `Couldn't find the lunar return: ${describeError(cause)}`,
      };
    }
  });
  const lunarReturn = $derived(lunarReturnResult?.lunarReturn);
  const lunarReturnAlert = $derived(
    lunarReturnError || lunarReturnResult?.failure || "",
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
      zodiac = shared.ayanamsa ?? TROPICAL;
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
        returnStyle = shared.solarReturn.style ?? ReturnStyle.Standalone;
        returnYear = year;
        returnPlace = resolved;
        shownReturn = { year, place: resolved };
        panel = Panel.SolarReturn;
      }
      if (shared.lunarReturn) {
        const { date, place } = shared.lunarReturn;
        // No place in the link means the birthplace.
        const resolved = place ? await resolvePlace(place) : yours.place!;
        lunarReturnStyle = shared.lunarReturn.style ?? ReturnStyle.Standalone;
        lunarReturnDate = formatDateValue(date);
        lunarReturnPlace = resolved;
        shownLunarReturn = { date, place: resolved };
        panel = Panel.LunarReturn;
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
      zodiac = saved.ayanamsa ?? TROPICAL;
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
        ayanamsa,
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
      ayanamsa,
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
    returnStyle = ReturnStyle.Standalone;
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

  /**
   * Opens the lunar return in effect today, on the visitor's clock, cast
   * at the birthplace. Without a birth time, it opens on why there isn't
   * one.
   */
  function startLunarReturn(): Promise<void> {
    lunarReturnStyle = ReturnStyle.Standalone;
    lunarReturnPlace = chart?.details.place;
    lunarReturnDate = formatDateValue(toLocal(new Date(), transitTimeZone));
    shownLunarReturn = undefined;
    lunarReturnError = "";

    showLunarReturn();
    return openPanel(Panel.LunarReturn, LUNAR_RETURN_DATE_ID);
  }

  function showLunarReturn(): void {
    if (!chart?.details.time) {
      lunarReturnError = LUNAR_RETURN_NEEDS_TIME;
      return;
    }
    if (!lunarReturnDate) {
      lunarReturnError = "Enter a date.";
      return;
    }
    if (!lunarReturnPlace) {
      lunarReturnError =
        "Choose a place from the list, or enter its coordinates.";
      return;
    }

    try {
      const date = parseLocalDate(lunarReturnDate);
      shownLunarReturn = { date, place: lunarReturnPlace };
      lunarReturnError = "";
    } catch (cause) {
      lunarReturnError = `Couldn't find the lunar return: ${describeError(cause)}`;
    }
  }

  function onLunarReturnSubmit(event: SubmitEvent): void {
    event.preventDefault();
    showLunarReturn();
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
    shownLunarReturn = undefined;
    lunarReturnError = "";
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
  <div class="flex min-w-0 flex-col gap-6 self-start">
    <YourChartForm
      bind:form={yours}
      {isHydrated}
      {isDrawing}
      {error}
      {savedCharts}
      {savedChartsError}
      onsubmit={onSubmit}
      onfocusin={requestEngine}
      onTimeUnknownChange={redrawIfDrawn}
      onUseSaved={useSavedForYou}
      onForgetSaved={forgetSavedChart}
      onSave={(name) => saveForm(yours, name)}
    >
      {#snippet settings()}
        <ChartSettingsFields
          bind:houseSystem
          bind:zodiac
          bind:aspectSet
          bind:orbSize
          {isHouseSystemUnused}
          note={settingsNote}
          onchange={onSettingChange}
        />
      {/snippet}
    </YourChartForm>

    {#if chart && panel === Panel.None}
      <AddToChartMenu
        onCompare={startComparing}
        onTransits={startTransits}
        onProgressions={startProgressions}
        onSolarReturn={startSolarReturn}
        onLunarReturn={startLunarReturn}
      />
    {/if}

    {#if panel === Panel.Transits}
      <TransitsPanel
        bind:date={transitDate}
        bind:time={transitTime}
        timeZone={transitTimeZone}
        alert={transitAlert}
        onsubmit={onTransitSubmit}
        onNow={() => setTransitMoment(new Date())}
        onBack={closePanel}
      />
    {/if}

    {#if panel === Panel.Progressions}
      <ProgressionsPanel
        bind:date={progressionsDate}
        minDate={chart ? formatDateValue(chart.details.date) : undefined}
        alert={progressionsAlert}
        onsubmit={onProgressionsSubmit}
        onToday={() =>
          setProgressionsDate(toLocal(new Date(), transitTimeZone))}
        onBack={closePanel}
      />
    {/if}

    {#if panel === Panel.SolarReturn}
      <SolarReturnPanel
        bind:year={returnYear}
        bind:place={returnPlace}
        alert={returnAlert}
        onsubmit={onReturnSubmit}
        onBack={closePanel}
      />
    {/if}

    {#if panel === Panel.LunarReturn}
      <LunarReturnPanel
        bind:date={lunarReturnDate}
        bind:place={lunarReturnPlace}
        minDate={chart ? formatDateValue(chart.details.date) : undefined}
        alert={lunarReturnAlert}
        onsubmit={onLunarReturnSubmit}
        onToday={() => {
          lunarReturnDate = formatDateValue(
            toLocal(new Date(), transitTimeZone),
          );
          showLunarReturn();
        }}
        onBack={closePanel}
      />
    {/if}

    {#if panel === Panel.Comparison}
      <ComparePanel
        bind:form={theirs}
        bind:style={comparisonStyle}
        {isDrawing}
        alert={compareAlert}
        {savedCharts}
        {savedChartsError}
        onsubmit={onCompareSubmit}
        onfocusin={requestEngine}
        onTimeUnknownChange={recompareIfCompared}
        onUseSaved={useSavedForThem}
        onForgetSaved={forgetSavedChart}
        onSave={(name) => saveForm(theirs, name)}
        onStop={closePanel}
      />
    {/if}
  </div>

  <section aria-live="polite" class="min-w-0" bind:this={result}>
    <ChartResult
      {chart}
      {composite}
      {synastry}
      {transits}
      {progressions}
      {solarReturn}
      {lunarReturn}
      bind:solarReturnStyle={returnStyle}
      bind:lunarReturnStyle
      timeZone={transitTimeZone}
    />
  </section>
</main>
