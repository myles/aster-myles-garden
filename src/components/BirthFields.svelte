<!-- Date, time and place fields for one person. Used for your chart and for
     the person you compare it with, so every id takes a prefix. -->
<script lang="ts">
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

<PlacePicker id={`${idPrefix}-place`} bind:selected={place} />
