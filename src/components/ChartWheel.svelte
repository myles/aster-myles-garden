<!-- Hosts the D3 wheel. Svelte owns the <svg>; D3 owns everything in it. -->
<script lang="ts">
  import type { Chart } from "@/lib/chart";
  import { drawBiWheel, drawWheel, type BiWheel } from "@/lib/wheel";

  // svg is bindable so the chart's downloads can export the drawn wheel.
  // With biWheel, it draws a bi-wheel instead of the chart alone.
  let {
    chart,
    biWheel,
    svg = $bindable(),
  }: { chart: Chart; biWheel?: BiWheel; svg?: SVGSVGElement } = $props();

  $effect(() => {
    if (biWheel) {
      drawBiWheel(svg!, biWheel);
      return;
    }

    drawWheel(svg!, chart);
  });
</script>

<div class="mx-auto my-6 w-full max-w-[38rem]">
  <svg bind:this={svg}></svg>
</div>
