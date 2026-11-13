<!-- Birth form and chart view. Talks to the chart service, place search
     and wheel renderer — never to the ephemeris. -->
<script lang="ts">
  import ChartView from "@/components/ChartView.svelte";
  import PlacePicker from "@/components/PlacePicker.svelte";
  import { createChart, loadChartEngine, type Chart } from "@/lib/chart";
  import { describeError } from "@/lib/format";
  import {
    DEFAULT_HOUSE_SYSTEM,
    HOUSE_SYSTEM_NAMES,
    HouseSystem,
    isHouseSystem,
  } from "@/lib/houses";
  import type { Place } from "@/lib/places";
  import { parseLocalDateTime } from "@/lib/time";

  const houseSystems = Object.values(HouseSystem);

  let date = $state("");
  let time = $state("");
  let houseSystem: string = $state(DEFAULT_HOUSE_SYSTEM);
  let place: Place | undefined = $state.raw();
  let chart: Chart | undefined = $state.raw();
  let error = $state("");
  let isDrawing = $state(false);
  let hasRequestedEngine = false;

  // Start fetching the WASM engine as soon as someone engages the form.
  function requestEngine(): void {
    if (hasRequestedEngine) {
      return;
    }

    hasRequestedEngine = true;
    loadChartEngine().catch((cause: unknown) => {
      error = `Couldn't load the calculator: ${describeError(cause)}`;
    });
  }

  async function draw(): Promise<void> {
    if (!date || !time) {
      error = "Enter both a date and a time.";
      return;
    }
    if (!place) {
      error = "Choose a place from the list.";
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
      chart = createChart({
        local: parseLocalDateTime(date, time),
        place,
        houseSystem,
      });
    } catch (cause) {
      error = `Couldn't draw the chart: ${describeError(cause)}`;
    } finally {
      isDrawing = false;
    }
  }

  function onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    void draw();
  }

  // Switching house systems redraws an existing chart in place.
  function onHouseSystemChange(): void {
    if (chart) {
      void draw();
    }
  }
</script>

<main class="grid flex-1 gap-8 lg:grid-cols-[20rem_1fr]">
  <form
    class="border-rule bg-panel flex flex-col gap-5 self-start rounded-lg border p-5"
    novalidate
    onfocusin={requestEngine}
    onsubmit={onSubmit}
  >
    <div class="flex flex-col gap-1.5">
      <label for="birth-date" class="text-sm font-medium">Date</label>
      <input
        id="birth-date"
        name="date"
        type="date"
        required
        min="0001-01-01"
        max="9999-12-31"
        class="border-rule bg-paper rounded border px-3 py-2"
        bind:value={date}
      />
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="birth-time" class="text-sm font-medium">Time</label>
      <input
        id="birth-time"
        name="time"
        type="time"
        required
        class="border-rule bg-paper rounded border px-3 py-2"
        bind:value={time}
      />
      <p class="text-ink-muted text-xs">
        Local clock time where you were born.
      </p>
    </div>

    <PlacePicker bind:selected={place} />

    <div class="flex flex-col gap-1.5">
      <label for="house-system" class="text-sm font-medium">
        House system
      </label>
      <select
        id="house-system"
        name="houseSystem"
        class="border-rule bg-paper rounded border px-3 py-2"
        bind:value={houseSystem}
        onchange={onHouseSystemChange}
      >
        {#each houseSystems as system (system)}
          <option value={system}>{HOUSE_SYSTEM_NAMES[system]}</option>
        {/each}
      </select>
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

  <section aria-live="polite" class="min-w-0">
    {#if chart}
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
