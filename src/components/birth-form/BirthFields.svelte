<!-- Date, time and place fields for one person. Used for your chart and for
     the person you compare it with, so every id takes a prefix. -->
<script lang="ts">
  import HelpToggle from "@/components/guide/HelpToggle.svelte";
  import { GuideTopic } from "@/components/guide/topics";
  import Field from "@/components/ui/Field.svelte";
  import Input from "@/components/ui/Input.svelte";
  import PlaceFields from "@/components/birth-form/PlaceFields.svelte";
  import { LAST_CALCULABLE_DATE_VALUE } from "@/lib/charts/chart";
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

<Field id={`${idPrefix}-date`} label="Date">
  {#snippet help()}<HelpToggle topic={GuideTopic.BirthDate} />{/snippet}
  <Input
    id={`${idPrefix}-date`}
    name="date"
    type="date"
    required
    min="0001-01-01"
    max={LAST_CALCULABLE_DATE_VALUE}
    bind:value={date}
  />
</Field>

<Field id={`${idPrefix}-time`} label="Time">
  {#snippet help()}<HelpToggle topic={GuideTopic.BirthTime} />{/snippet}
  <Input
    id={`${idPrefix}-time`}
    name="time"
    type="time"
    required={!isTimeUnknown}
    disabled={isTimeUnknown}
    bind:value={time}
  />
  <p class="ui-hint">
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
</Field>

<PlaceFields {idPrefix} bind:place>
  {#snippet help()}<HelpToggle topic={GuideTopic.BirthPlace} />{/snippet}
</PlaceFields>
