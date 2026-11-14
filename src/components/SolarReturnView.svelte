<!-- A solar return: the chart for the moment the Sun gets back to its natal
     position, cast where you are that year, with its positions and aspects. -->
<script lang="ts">
  import AspectTable from "@/components/AspectTable.svelte";
  import ChartDownloads from "@/components/ChartDownloads.svelte";
  import ChartShare from "@/components/ChartShare.svelte";
  import ChartWheel from "@/components/ChartWheel.svelte";
  import PositionsTable from "@/components/PositionsTable.svelte";
  import { Body } from "@/lib/bodies";
  import { usesFallbackHouses } from "@/lib/chart";
  import { SubjectKind } from "@/lib/export";
  import { formatBirthMoment } from "@/lib/format";
  import { describeHouseFallback, HOUSE_SYSTEM_NAMES } from "@/lib/houses";
  import { formatPlace } from "@/lib/places";
  import type { SolarReturn } from "@/lib/solar-return";
  import { formatLongitude } from "@/lib/zodiac";

  let { solarReturn }: { solarReturn: SolarReturn } = $props();

  let wheel: SVGSVGElement | undefined = $state();

  const chart = $derived(solarReturn.chart);

  const subheading = $derived(
    [
      formatPlace(chart.details.place),
      formatBirthMoment(chart),
      chart.houses && HOUSE_SYSTEM_NAMES[chart.houses.houseSystem],
    ]
      .filter(Boolean)
      .join(" · "),
  );

  const natalSun = $derived(
    solarReturn.natal.bodies.find((placed) => placed.body === Body.Sun),
  );

  const fallbackNote = $derived(
    chart.houses && usesFallbackHouses(chart)
      ? describeHouseFallback(
          chart.details.houseSystem,
          chart.houses.houseSystem,
          "the return uses",
        )
      : undefined,
  );
</script>

<div>
  <h2 class="font-serif text-2xl" tabindex="-1">
    Solar return {solarReturn.year}
  </h2>
  <p class="text-ink-muted mt-1 text-sm">{subheading}</p>
  {#if natalSun}
    <p class="text-ink-muted mt-2 text-sm">
      The Sun returns to {formatLongitude(natalSun.longitude)}, where it was
      when you were born. The chart is read for the year until the next return.
    </p>
  {/if}

  {#if fallbackNote}
    <p class="border-rule bg-panel mt-4 rounded-md border p-3 text-sm">
      {fallbackNote}
    </p>
  {/if}

  <ChartWheel {chart} title="Solar return chart wheel" bind:svg={wheel} />

  <div class="grid gap-8 xl:grid-cols-2">
    <PositionsTable {chart} title="Positions" />

    <AspectTable
      aspects={chart.aspects}
      settings={chart.details.aspectSettings}
    />
  </div>

  <div class="border-rule mt-10 grid gap-8 border-t pt-5 sm:grid-cols-2">
    <ChartShare
      details={solarReturn.natal.details}
      addition={{
        solarReturn: { year: solarReturn.year, place: chart.details.place },
      }}
    />
    <ChartDownloads
      subject={{ kind: SubjectKind.SolarReturn, solarReturn }}
      {wheel}
    />
  </div>
</div>
