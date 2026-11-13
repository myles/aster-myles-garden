<!-- Date, time and place fields for one person. Used for your chart and for
     the person you compare it with, so every id takes a prefix. A place is
     chosen from the list or, if it isn't listed, entered by coordinates. -->
<script lang="ts">
  import CoordinateFields from "@/components/CoordinateFields.svelte";
  import PlacePicker from "@/components/PlacePicker.svelte";
  import type { Place } from "@/lib/places";

  let {
    idPrefix,
    timeHint,
    date = $bindable(""),
    time = $bindable(""),
    isTimeUnknown = $bindable(false),
    place = $bindable(),
    onTimeUnknownChange,
  }: {
    idPrefix: string;
    /** Shown under the time while it's known, e.g. "where you were born". */
    timeHint: string;
    date?: string;
    time?: string;
    isTimeUnknown?: boolean;
    place?: Place;
    onTimeUnknownChange?: () => void;
  } = $props();

  let isEnteringCoordinates = $state(false);

  // A place set from outside, e.g. a saved chart, picks the matching mode:
  // only places entered by coordinates lack a GeoNames ID.
  $effect(() => {
    if (place) {
      isEnteringCoordinates = place.id === undefined;
    }
  });

  // Switching modes drops the place, so a stale one can't be drawn.
  function switchPlaceMode(): void {
    isEnteringCoordinates = !isEnteringCoordinates;
    place = undefined;
  }
</script>

<div class="flex flex-col gap-1.5">
  <label for={`${idPrefix}-date`} class="text-sm font-medium">Date</label>
  <input
    id={`${idPrefix}-date`}
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
  <label for={`${idPrefix}-time`} class="text-sm font-medium">Time</label>
  <input
    id={`${idPrefix}-time`}
    name="time"
    type="time"
    required={!isTimeUnknown}
    disabled={isTimeUnknown}
    class="border-rule bg-paper rounded border px-3 py-2 disabled:opacity-50"
    bind:value={time}
  />
  <p class="text-ink-muted text-xs">
    {isTimeUnknown ? "The chart is cast for noon, without houses." : timeHint}
  </p>
  <label class="mt-1 flex items-center gap-2 text-sm">
    <input
      type="checkbox"
      name="timeUnknown"
      class="accent-accent size-4"
      bind:checked={isTimeUnknown}
      onchange={onTimeUnknownChange}
    />
    I don't know the time
  </label>
</div>

{#if isEnteringCoordinates}
  <fieldset class="flex flex-col gap-5">
    <legend class="mb-3 text-sm font-medium">Place, by coordinates</legend>
    <CoordinateFields {idPrefix} bind:place />
  </fieldset>
{:else}
  <PlacePicker id={`${idPrefix}-place`} bind:selected={place} />
{/if}

<button
  type="button"
  class="text-ink-muted hover:text-ink -mt-3 self-start text-xs underline"
  onclick={switchPlaceMode}
>
  {isEnteringCoordinates
    ? "Search the list instead"
    : "Not listed? Enter coordinates"}
</button>
