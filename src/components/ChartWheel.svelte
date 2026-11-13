<!-- Hosts the D3 wheel. Svelte owns the <svg>; D3 owns everything in it. -->
<script lang="ts">
  import type { Chart } from "@/lib/chart";
  import { ExportFormat, exportWheel } from "@/lib/export";
  import { describeError } from "@/lib/format";
  import { drawWheel } from "@/lib/wheel";

  let { chart }: { chart: Chart } = $props();

  let svg: SVGSVGElement;
  let exportError = $state("");

  $effect(() => {
    drawWheel(svg, chart);
  });

  async function download(format: ExportFormat): Promise<void> {
    exportError = "";

    try {
      await exportWheel(svg, chart, format);
    } catch (cause) {
      exportError = `Couldn't export the chart: ${describeError(cause)}`;
    }
  }
</script>

<div class="mx-auto my-6 w-full max-w-[38rem]">
  <svg bind:this={svg}></svg>

  <div class="mt-3 flex justify-end gap-2">
    <button
      type="button"
      class="border-rule hover:bg-panel rounded border px-3 py-1.5 text-sm"
      onclick={() => download(ExportFormat.Svg)}
    >
      Download SVG
    </button>
    <button
      type="button"
      class="border-rule hover:bg-panel rounded border px-3 py-1.5 text-sm"
      onclick={() => download(ExportFormat.Png)}
    >
      Download PNG
    </button>
  </div>

  <p
    role="alert"
    class="mt-2 text-right text-sm text-[var(--challenging)]"
    hidden={exportError.length === 0}
  >
    {exportError}
  </p>
</div>
