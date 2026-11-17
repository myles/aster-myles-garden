<!-- The date whose lunar return to show, and where to cast it. -->
<script lang="ts">
  import PlaceFields from "@/components/birth-form/PlaceFields.svelte";
  import { LUNAR_RETURN_DATE_ID } from "@/components/panels/ids";
  import Alert from "@/components/ui/Alert.svelte";
  import Button from "@/components/ui/Button.svelte";
  import ButtonRow from "@/components/ui/ButtonRow.svelte";
  import Field from "@/components/ui/Field.svelte";
  import FormPanel from "@/components/ui/FormPanel.svelte";
  import Input from "@/components/ui/Input.svelte";
  import { LAST_CALCULABLE_DATE_VALUE } from "@/lib/charts/chart";
  import type { Place } from "@/lib/places";

  let {
    date = $bindable(),
    place = $bindable(),
    minDate,
    alert,
    onsubmit,
    onToday,
    onBack,
  }: {
    /** As <input type="date"> holds it. */
    date: string;
    place?: Place;
    /** The birth date, as <input type="date"> holds it. */
    minDate?: string;
    alert: string;
    onsubmit: (event: SubmitEvent) => void;
    onToday: () => void;
    onBack: () => void;
  } = $props();
</script>

<FormPanel title="Lunar return" {onsubmit}>
  {#snippet description()}The chart for the moment the Moon gets back to where
    it was when you were born, about every 27 days, cast for where you are then.
    It shows the return in effect on the date.{/snippet}

  <Field id={LUNAR_RETURN_DATE_ID} label="Date">
    <Input
      id={LUNAR_RETURN_DATE_ID}
      name="lunarReturnDate"
      type="date"
      required
      min={minDate}
      max={LAST_CALCULABLE_DATE_VALUE}
      bind:value={date}
    />
  </Field>

  <PlaceFields idPrefix="lunar-return" bind:place />

  <ButtonRow>
    <Button variant="primary" type="submit">Show lunar return</Button>
    <Button onclick={onToday}>Today</Button>
    <Button onclick={onBack}>Back to your chart</Button>
  </ButtonRow>

  <Alert message={alert} />
</FormPanel>
