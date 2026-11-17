<!-- Which year's solar return to show, and where to cast it. -->
<script lang="ts">
  import PlaceFields from "@/components/birth-form/PlaceFields.svelte";
  import { RETURN_YEAR_ID } from "@/components/panels/ids";
  import Alert from "@/components/ui/Alert.svelte";
  import Button from "@/components/ui/Button.svelte";
  import ButtonRow from "@/components/ui/ButtonRow.svelte";
  import Field from "@/components/ui/Field.svelte";
  import FormPanel from "@/components/ui/FormPanel.svelte";
  import Input from "@/components/ui/Input.svelte";
  import type { Place } from "@/lib/places";

  let {
    year = $bindable(),
    place = $bindable(),
    alert,
    onsubmit,
    onBack,
  }: {
    /** A number input binds a number, or null while it's empty. */
    year: number | null;
    place?: Place;
    alert: string;
    onsubmit: (event: SubmitEvent) => void;
    onBack: () => void;
  } = $props();
</script>

<FormPanel title="Solar return" {onsubmit}>
  {#snippet description()}The chart for the moment the Sun gets back to where it
    was when you were born, cast for where you are on that birthday.{/snippet}

  <Field id={RETURN_YEAR_ID} label="Year">
    <Input
      id={RETURN_YEAR_ID}
      name="returnYear"
      type="number"
      inputmode="numeric"
      required
      min="1"
      max="3002"
      step="1"
      bind:value={year}
    />
  </Field>

  <PlaceFields idPrefix="return" bind:place />

  <ButtonRow>
    <Button variant="primary" type="submit">Show solar return</Button>
    <Button onclick={onBack}>Back to your chart</Button>
  </ButtonRow>

  <Alert message={alert} />
</FormPanel>
