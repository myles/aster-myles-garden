<!-- Charts saved in this browser, to fill a form with one press. -->
<script lang="ts">
  import Button from "@/components/ui/Button.svelte";
  import { formatPlace } from "@/lib/places";
  import type { SavedChart } from "@/lib/storage/saved-charts";

  let {
    charts,
    onUse,
    onForget,
  }: {
    charts: SavedChart[];
    onUse: (chart: SavedChart) => void;
    onForget: (chart: SavedChart) => void;
  } = $props();

  function describe(chart: SavedChart): string {
    const time = chart.time ?? "time unknown";
    return `${chart.date}, ${time} · ${formatPlace(chart.place)}`;
  }
</script>

{#if charts.length > 0}
  <details class="border-rule rounded border text-sm" open>
    <summary class="cursor-pointer px-3 py-2 font-medium">
      Saved charts ({charts.length})
    </summary>
    <ul class="divide-rule divide-y border-t border-[inherit]">
      {#each charts as chart (chart.id)}
        <li class="flex items-center gap-2 px-3 py-2">
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium">{chart.name}</p>
            <p class="text-ink-muted truncate text-xs">{describe(chart)}</p>
          </div>
          <Button
            size="small"
            aria-label={`Use ${chart.name}`}
            onclick={() => onUse(chart)}
          >
            Use
          </Button>
          <Button
            variant="quiet"
            class="px-1 py-1"
            aria-label={`Forget ${chart.name}`}
            onclick={() => onForget(chart)}
          >
            Forget
          </Button>
        </li>
      {/each}
    </ul>
  </details>
{/if}
