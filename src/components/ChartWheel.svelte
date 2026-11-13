<!-- Hosts the D3 wheel. Svelte owns the <svg>; D3 owns everything in it. -->
<script lang="ts">
  import type { Chart } from "@/lib/chart";
  import { describeBiWheel, describeWheel } from "@/lib/describe";
  import { drawBiWheel, drawWheel, type BiWheel } from "@/lib/wheel";

  // svg is bindable so the chart's downloads can export the drawn wheel.
  // With biWheel, it draws a bi-wheel instead of the chart alone.
  let {
    chart,
    biWheel,
    svg = $bindable(),
  }: { chart: Chart; biWheel?: BiWheel; svg?: SVGSVGElement } = $props();

  // The same words screen readers get from the <svg>'s description, shown
  // for anyone who finds the wheel hard to read.
  const description = $derived(
    biWheel ? describeBiWheel(biWheel) : describeWheel(chart),
  );

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

  <details class="mt-3 text-sm">
    <summary class="text-ink-muted cursor-pointer">Describe the wheel</summary>
    <ul class="mt-2 flex list-disc flex-col gap-1 pl-5">
      {#each description as sentence (sentence)}
        <li>{sentence}</li>
      {/each}
    </ul>
  </details>
</div>
