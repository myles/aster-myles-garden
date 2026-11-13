<!-- Hosts the D3 wheel. Svelte owns the <svg>; D3 owns everything in it. -->
<script lang="ts">
  import type { Chart } from "@/lib/chart";
  import type { Synastry } from "@/lib/synastry";
  import { drawBiWheel, drawWheel } from "@/lib/wheel";

  // svg is bindable so the chart's downloads can export the drawn wheel.
  // With a synastry, the wheel becomes a bi-wheel of both charts.
  let {
    chart,
    synastry,
    svg = $bindable(),
  }: { chart: Chart; synastry?: Synastry; svg?: SVGSVGElement } = $props();

  $effect(() => {
    if (synastry) {
      drawBiWheel(svg!, synastry);
      return;
    }

    drawWheel(svg!, chart);
  });
</script>

<div class="mx-auto my-6 w-full max-w-[38rem]">
  <svg bind:this={svg}></svg>
</div>
