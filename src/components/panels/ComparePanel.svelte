<!-- Someone else's birth details, to compare with your chart as a
     bi-wheel or a composite. Their chart uses your settings. -->
<script lang="ts">
  import BirthFields from "@/components/birth-form/BirthFields.svelte";
  import type { BirthForm } from "@/components/birth-form/birth-form";
  import SaveChartRow from "@/components/saved-charts/SaveChartRow.svelte";
  import SavedChartList from "@/components/saved-charts/SavedChartList.svelte";
  import Alert from "@/components/ui/Alert.svelte";
  import Button from "@/components/ui/Button.svelte";
  import ButtonRow from "@/components/ui/ButtonRow.svelte";
  import FormPanel from "@/components/ui/FormPanel.svelte";
  import {
    COMPARISON_STYLE_NAMES,
    ComparisonStyle,
  } from "@/lib/charts/synastry";
  import type { SavedChart } from "@/lib/storage/saved-charts";

  let {
    form = $bindable(),
    style = $bindable(),
    isDrawing,
    alert,
    savedCharts,
    savedChartsError,
    onsubmit,
    onfocusin,
    onTimeUnknownChange,
    onUseSaved,
    onForgetSaved,
    onSave,
    onStop,
  }: {
    form: BirthForm;
    style: ComparisonStyle;
    isDrawing: boolean;
    alert: string;
    savedCharts: SavedChart[];
    savedChartsError: string;
    onsubmit: (event: SubmitEvent) => void;
    onfocusin: () => void;
    onTimeUnknownChange: () => void;
    onUseSaved: (chart: SavedChart) => void;
    onForgetSaved: (chart: SavedChart) => void;
    /** Returns why it couldn't save, or undefined. */
    onSave: (name: string) => string | undefined;
    onStop: () => void;
  } = $props();

  const styles = Object.values(ComparisonStyle);
</script>

<FormPanel title="Their birth details" showTitle={false} {onfocusin} {onsubmit}>
  <div>
    <h2 class="ui-heading-section">Compare with someone else</h2>
    <p class="ui-hint">Their chart uses your house system.</p>
  </div>

  <SavedChartList
    charts={savedCharts}
    onUse={onUseSaved}
    onForget={onForgetSaved}
  />

  <BirthFields
    idPrefix="compare"
    timeHint="Local clock time where they were born."
    bind:date={form.date}
    bind:time={form.time}
    bind:isTimeUnknown={form.isTimeUnknown}
    bind:place={form.place}
    {onTimeUnknownChange}
  />

  <fieldset class="ui-field">
    <legend class="ui-label">Show</legend>
    <div class="flex gap-4">
      {#each styles as option (option)}
        <label class="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="comparisonStyle"
            value={option}
            bind:group={style}
          />
          {COMPARISON_STYLE_NAMES[option]}
        </label>
      {/each}
    </div>
  </fieldset>

  <ButtonRow>
    <Button variant="primary" type="submit" disabled={isDrawing}>
      Compare charts
    </Button>
    <Button onclick={onStop}>Stop comparing</Button>
  </ButtonRow>

  <Alert message={alert} />

  <SaveChartRow
    idPrefix="compare"
    blockedReason={savedChartsError || undefined}
    {onSave}
  />
</FormPanel>
