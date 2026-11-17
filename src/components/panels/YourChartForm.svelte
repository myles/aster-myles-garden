<!-- Your birth details, the chart settings, and the button that draws
     your chart. Saved charts sit at the top, to fill it in with a press. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  import BirthFields from "@/components/birth-form/BirthFields.svelte";
  import type { BirthForm } from "@/components/birth-form/birth-form";
  import SaveChartRow from "@/components/saved-charts/SaveChartRow.svelte";
  import SavedChartList from "@/components/saved-charts/SavedChartList.svelte";
  import Alert from "@/components/ui/Alert.svelte";
  import Button from "@/components/ui/Button.svelte";
  import FormPanel from "@/components/ui/FormPanel.svelte";
  import type { SavedChart } from "@/lib/storage/saved-charts";

  let {
    form = $bindable(),
    isHydrated,
    isDrawing,
    error,
    savedCharts,
    savedChartsError,
    settings,
    onsubmit,
    onfocusin,
    onTimeUnknownChange,
    onUseSaved,
    onForgetSaved,
    onSave,
  }: {
    form: BirthForm;
    /** Until the page's script runs, nothing can be entered. */
    isHydrated: boolean;
    isDrawing: boolean;
    error: string;
    savedCharts: SavedChart[];
    /** Why saved charts can't be used, e.g. the browser blocks storage. */
    savedChartsError: string;
    /** The chart settings, between the birth details and the button. */
    settings: Snippet;
    onsubmit: (event: SubmitEvent) => void;
    onfocusin: () => void;
    onTimeUnknownChange: () => void;
    onUseSaved: (chart: SavedChart) => void;
    onForgetSaved: (chart: SavedChart) => void;
    /** Returns why it couldn't save, or undefined. */
    onSave: (name: string) => string | undefined;
  } = $props();
</script>

<FormPanel title="Your birth details" showTitle={false} {onfocusin} {onsubmit}>
  {#if !isHydrated}
    <p class="text-ink-muted text-sm">
      JavaScript is required to calculate your chart in your browser. Enable it
      to enter your birth details.
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
      onUse={onUseSaved}
      onForget={onForgetSaved}
    />

    <BirthFields
      idPrefix="birth"
      timeHint="Local clock time where you were born."
      bind:date={form.date}
      bind:time={form.time}
      bind:isTimeUnknown={form.isTimeUnknown}
      bind:place={form.place}
      {onTimeUnknownChange}
    />

    {@render settings()}

    <Button variant="primary" type="submit" disabled={isDrawing}>
      Draw chart
    </Button>

    <Alert message={error} />

    <SaveChartRow
      idPrefix="birth"
      blockedReason={savedChartsError || undefined}
      {onSave}
    />
  </fieldset>
</FormPanel>
