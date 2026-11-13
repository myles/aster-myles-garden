<!-- Hosts the D3 wheel. Svelte owns the <svg>; D3 owns everything in it. -->
<script lang="ts">
  import type { Chart } from "@/lib/chart";
  import { drawWheel } from "@/lib/wheel";

  let { chart }: { chart: Chart } = $props();

  let svg: SVGSVGElement;

  $effect(() => {
    drawWheel(svg, chart);
  });
</script>

<div class="mx-auto my-6 w-full max-w-[38rem]">
  <svg bind:this={svg}></svg>
</div>
