<!-- Download buttons for the chart: the wheel as an image, the tables as CSV. -->
<script lang="ts">
  import type { Chart } from "@/lib/chart";
  import { ExportFormat, exportTables, exportWheel } from "@/lib/export";
  import { describeError } from "@/lib/format";

  let { chart, wheel }: { chart: Chart; wheel?: SVGSVGElement } = $props();

  let error = $state("");
  let isExporting = $state(false);

  const buttonClass =
    "bg-panel hover:bg-accent/10 focus-visible:outline-accent inline-flex " +
    "items-center gap-1.5 px-3 py-1.5 text-sm font-medium " +
    "focus-visible:relative focus-visible:outline-2 " +
    "disabled:cursor-wait disabled:opacity-50";

  async function download(save: () => void | Promise<void>): Promise<void> {
    error = "";
    isExporting = true;

    try {
      await save();
    } catch (cause) {
      error = `Couldn't export the chart: ${describeError(cause)}`;
    } finally {
      isExporting = false;
    }
  }

  function saveWheel(format: ExportFormat): Promise<void> {
    if (!wheel) {
      throw new Error("The wheel hasn't been drawn yet.");
    }
    return exportWheel(wheel, chart, format);
  }
</script>

{#snippet downloadIcon()}
  <svg
    aria-hidden="true"
    viewBox="0 0 16 16"
    class="size-4"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" />
  </svg>
{/snippet}

<div>
  <h3 class="mb-3 font-serif text-lg">Download</h3>

  <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
    <div class="flex items-center gap-2">
      <span id="download-wheel" class="text-ink-muted text-sm">Wheel</span>
      <div
        role="group"
        aria-labelledby="download-wheel"
        class="border-rule divide-rule inline-flex divide-x overflow-hidden rounded-md border"
      >
        <button
          type="button"
          class={buttonClass}
          aria-label="Download wheel as SVG"
          disabled={isExporting}
          onclick={() => download(() => saveWheel(ExportFormat.Svg))}
        >
          {@render downloadIcon()} SVG
        </button>
        <button
          type="button"
          class={buttonClass}
          aria-label="Download wheel as PNG"
          disabled={isExporting}
          onclick={() => download(() => saveWheel(ExportFormat.Png))}
        >
          {@render downloadIcon()} PNG
        </button>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <span id="download-tables" class="text-ink-muted text-sm">Tables</span>
      <div
        role="group"
        aria-labelledby="download-tables"
        class="border-rule inline-flex overflow-hidden rounded-md border"
      >
        <button
          type="button"
          class={buttonClass}
          aria-label="Download tables as CSV"
          disabled={isExporting}
          onclick={() => download(() => exportTables(chart))}
        >
          {@render downloadIcon()} CSV
        </button>
      </div>
    </div>
  </div>

  <p
    role="alert"
    class="mt-3 text-sm text-[var(--challenging)]"
    hidden={error.length === 0}
  >
    {error}
  </p>
</div>
