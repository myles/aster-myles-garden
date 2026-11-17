<!-- Whatever's on screen beside the forms: one view, chosen by what's
     been added to your chart, or a prompt before anything is drawn. -->
<script lang="ts">
  import ChartView from "@/components/views/ChartView.svelte";
  import ComparisonView from "@/components/views/ComparisonView.svelte";
  import CompositeView from "@/components/views/CompositeView.svelte";
  import LunarReturnView from "@/components/views/LunarReturnView.svelte";
  import ProgressionView from "@/components/views/ProgressionView.svelte";
  import SolarReturnView from "@/components/views/SolarReturnView.svelte";
  import TransitView from "@/components/views/TransitView.svelte";
  import type { Chart } from "@/lib/charts/chart";
  import type { Composite } from "@/lib/charts/composite";
  import type { LunarReturn } from "@/lib/charts/lunar-return";
  import type { Progressions } from "@/lib/charts/progressions";
  import type { ReturnStyle } from "@/lib/charts/returns";
  import type { SolarReturn } from "@/lib/charts/solar-return";
  import type { Synastry } from "@/lib/charts/synastry";
  import type { Transits } from "@/lib/charts/transits";

  // At most one addition is set; the first that is wins.
  let {
    chart,
    composite,
    synastry,
    transits,
    progressions,
    solarReturn,
    lunarReturn,
    solarReturnStyle = $bindable(),
    lunarReturnStyle = $bindable(),
    timeZone,
  }: {
    chart?: Chart;
    composite?: Composite;
    synastry?: Synastry;
    transits?: Transits;
    progressions?: Progressions;
    solarReturn?: SolarReturn;
    lunarReturn?: LunarReturn;
    solarReturnStyle: ReturnStyle;
    lunarReturnStyle: ReturnStyle;
    /** The visitor's, for transit moments. */
    timeZone: string;
  } = $props();
</script>

{#if composite}
  <CompositeView {composite} />
{:else if synastry}
  <ComparisonView {synastry} />
{:else if transits}
  <TransitView {transits} {timeZone} />
{:else if progressions}
  <ProgressionView {progressions} />
{:else if solarReturn}
  <SolarReturnView {solarReturn} bind:style={solarReturnStyle} />
{:else if lunarReturn}
  <LunarReturnView {lunarReturn} bind:style={lunarReturnStyle} />
{:else if chart}
  <ChartView {chart} />
{:else}
  <div
    class="border-rule text-ink-muted flex h-full min-h-80 items-center justify-center rounded-lg border border-dashed p-8 text-center"
  >
    Enter a date, time and place to draw a chart.
  </div>
{/if}
