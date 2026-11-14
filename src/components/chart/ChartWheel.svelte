<!-- Hosts the D3 wheel. Svelte owns the <svg>; D3 owns everything in it. -->
<script lang="ts">
  import { describeBiWheel, describeWheel } from "@/lib/describe";
  import {
    drawBiWheel,
    drawWheel,
    type BiWheel,
    type WheelChart,
  } from "@/lib/wheel";

  // svg is bindable so the chart's downloads can export the drawn wheel.
  // With biWheel, it draws a bi-wheel instead of the chart alone. title
  // names a single wheel that isn't a natal chart.
  let {
    chart,
    biWheel,
    title,
    svg = $bindable(),
  }: {
    chart: WheelChart;
    biWheel?: BiWheel;
    title?: string;
    svg?: SVGSVGElement;
  } = $props();

  // On a phone the fitted wheel's labels are a few pixels tall. Enlarged,
  // it keeps this width and scrolls sideways instead, about three times
  // the size at 375px. Sized on a wrapper, since D3 owns the <svg>'s class.
  const ENLARGED_WIDTH_CLASS = "w-[56rem]";

  let isEnlarged = $state(false);

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

    drawWheel(svg!, chart, title);
  });
</script>

<div class="mx-auto my-6 w-full max-w-[38rem]">
  <!-- Focusable while enlarged, so the keyboard can scroll it too. -->
  <div
    class={isEnlarged ? "overflow-x-auto" : undefined}
    role={isEnlarged ? "region" : undefined}
    aria-label={isEnlarged ? "Enlarged wheel" : undefined}
    tabindex={isEnlarged ? 0 : undefined}
  >
    <div class={isEnlarged ? ENLARGED_WIDTH_CLASS : "w-full"}>
      <svg bind:this={svg}></svg>
    </div>
  </div>

  <button
    type="button"
    aria-pressed={String(isEnlarged)}
    class="border-rule bg-panel hover:bg-accent/10 focus-visible:outline-accent aria-pressed:bg-accent/15 mt-3 rounded-md border px-3 py-1.5 text-sm font-medium focus-visible:outline-2"
    onclick={() => (isEnlarged = !isEnlarged)}
  >
    Enlarge wheel
  </button>

  <details class="mt-3 text-sm">
    <summary class="text-ink-muted cursor-pointer">Describe the wheel</summary>
    <ul class="mt-2 flex list-disc flex-col gap-1 pl-5">
      {#each description as sentence (sentence)}
        <li>{sentence}</li>
      {/each}
    </ul>
  </details>
</div>
