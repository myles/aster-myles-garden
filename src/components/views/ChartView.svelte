<script lang="ts">
  import ZodiacNote from "@/components/chart/ZodiacNote.svelte";
  import AspectTable from "@/components/chart/AspectTable.svelte";
  import ChartDownloads from "@/components/chart/ChartDownloads.svelte";
  import ChartShare from "@/components/chart/ChartShare.svelte";
  import ChartWheel from "@/components/chart/ChartWheel.svelte";
  import PositionsTable from "@/components/chart/PositionsTable.svelte";
  import { usesFallbackHouses, type Chart } from "@/lib/charts/chart";
  import { SubjectKind } from "@/lib/downloads/export";
  import {
    formatBirthDate,
    formatBirthMoment,
    formatCoordinates,
  } from "@/lib/format";
  import {
    describeHouseFallback,
    HOUSE_SYSTEM_NAMES,
  } from "@/lib/astrology/houses";
  import { formatPlace } from "@/lib/places";

  let { chart }: { chart: Chart } = $props();

  let wheel: SVGSVGElement | undefined = $state();

  const coordinates = $derived(
    formatCoordinates(
      chart.details.place.latitude,
      chart.details.place.longitude,
    ),
  );

  // Without a birth time there are no houses, so no house system either.
  const subheading = $derived(
    chart.houses
      ? [
          formatBirthMoment(chart),
          coordinates,
          HOUSE_SYSTEM_NAMES[chart.houses.houseSystem],
        ].join(" · ")
      : [formatBirthDate(chart), "Time unknown", coordinates].join(" · "),
  );

  const fallbackNote = $derived(
    chart.houses && usesFallbackHouses(chart)
      ? describeHouseFallback(
          chart.details.houseSystem,
          chart.houses.houseSystem,
          "these are",
        )
      : undefined,
  );
</script>

<div>
  <h2 class="font-serif text-2xl" tabindex="-1">
    {formatPlace(chart.details.place)}
  </h2>
  <p class="text-ink-muted mt-1 text-sm">{subheading}</p>
  <ZodiacNote {chart} />

  {#if fallbackNote}
    <p class="border-rule bg-panel mt-4 rounded-md border p-3 text-sm">
      {fallbackNote}
    </p>
  {/if}

  {#if !chart.houses}
    <p class="border-rule bg-panel mt-4 rounded-md border p-3 text-sm">
      Without a birth time, this chart is cast for noon. Houses, the ascendant
      and the midheaven depend on the exact time, so they're left out. The Moon
      moves about 13° a day, so it may be up to 7° either side of where it's
      shown, and any body that changed sign that day says which other sign it
      may be in.
    </p>
  {/if}

  <ChartWheel {chart} bind:svg={wheel} />

  <div class="grid gap-8 xl:grid-cols-2">
    <PositionsTable {chart} title="Positions" />

    <AspectTable
      aspects={chart.aspects}
      settings={chart.details.aspectSettings}
    />
  </div>

  <div class="border-rule mt-10 grid gap-8 border-t pt-5 sm:grid-cols-2">
    <ChartShare details={chart.details} />
    <ChartDownloads subject={{ kind: SubjectKind.Chart, chart }} {wheel} />
  </div>
</div>
