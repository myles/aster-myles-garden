<!-- The moment to show transits for, on the visitor's clock. -->
<script lang="ts">
  import { TRANSIT_DATE_ID } from "@/components/panels/ids";
  import Alert from "@/components/ui/Alert.svelte";
  import Button from "@/components/ui/Button.svelte";
  import ButtonRow from "@/components/ui/ButtonRow.svelte";
  import Field from "@/components/ui/Field.svelte";
  import FormPanel from "@/components/ui/FormPanel.svelte";
  import Input from "@/components/ui/Input.svelte";
  import { LAST_CALCULABLE_DATE_VALUE } from "@/lib/charts/chart";

  let {
    date = $bindable(),
    time = $bindable(),
    timeZone,
    alert,
    onsubmit,
    onNow,
    onBack,
  }: {
    /** As <input type="date"> holds it. */
    date: string;
    /** As <input type="time"> holds it. */
    time: string;
    timeZone: string;
    alert: string;
    onsubmit: (event: SubmitEvent) => void;
    onNow: () => void;
    onBack: () => void;
  } = $props();
</script>

<FormPanel title="Transit moment" {onsubmit}>
  {#snippet description()}The sky at this moment, against your chart. Times are
    in your time zone, {timeZone}.{/snippet}

  <Field id={TRANSIT_DATE_ID} label="Date">
    <Input
      id={TRANSIT_DATE_ID}
      name="transitDate"
      type="date"
      required
      min="0001-01-01"
      max={LAST_CALCULABLE_DATE_VALUE}
      bind:value={date}
    />
  </Field>

  <Field id="transit-time" label="Time">
    <Input
      id="transit-time"
      name="transitTime"
      type="time"
      required
      bind:value={time}
    />
  </Field>

  <ButtonRow>
    <Button variant="primary" type="submit">Show transits</Button>
    <Button onclick={onNow}>Now</Button>
    <Button onclick={onBack}>Back to your chart</Button>
  </ButtonRow>

  <Alert message={alert} />
</FormPanel>
