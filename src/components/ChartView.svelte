<script lang="ts">
  import ChartDownloads from "@/components/ChartDownloads.svelte";
  import ChartShare from "@/components/ChartShare.svelte";
  import ChartWheel from "@/components/ChartWheel.svelte";
  import PositionsTable from "@/components/PositionsTable.svelte";
  import { ASPECT_INFO } from "@/lib/aspects";
  import { BODY_INFO } from "@/lib/bodies";
  import { usesFallbackHouses, type Chart } from "@/lib/chart";
  import { SubjectKind } from "@/lib/export";
  import {
    formatBirthDate,
    formatBirthMoment,
    formatCoordinates,
    formatDegrees,
    formatNoAspects,
  } from "@/lib/format";
  import { describeHouseFallback, HOUSE_SYSTEM_NAMES } from "@/lib/houses";
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

    <div>
      <h3 class="mb-2 font-serif text-lg">Aspects</h3>
      <table class="w-full text-sm">
        <thead class="text-ink-muted text-left">
          <tr class="border-rule border-b">
            <th scope="col" class="py-1.5 font-normal">Pair</th>
            <th scope="col" class="py-1.5 font-normal">Aspect</th>
            <th scope="col" class="py-1.5 text-right font-normal">Orb</th>
          </tr>
        </thead>
        <tbody>
          {#each chart.aspects as aspect (`${aspect.first}-${aspect.second}`)}
            {@const first = BODY_INFO[aspect.first]}
            {@const second = BODY_INFO[aspect.second]}
            {@const info = ASPECT_INFO[aspect.type]}
            <tr class="border-rule/60 border-b">
              <td class="py-1.5">
                {first.glyph}
                {first.name} – {second.glyph}
                {second.name}
              </td>
              <td class="py-1.5">{info.glyph} {info.name}</td>
              <td class="py-1.5 text-right tabular-nums">
                {formatDegrees(aspect.orbDegrees)}
              </td>
            </tr>
          {:else}
            <tr class="border-rule/60 border-b">
              <td class="py-1.5">
                {formatNoAspects(chart.details.aspectSettings)} within orb.
              </td>
              <td class="py-1.5"></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <div class="border-rule mt-10 grid gap-8 border-t pt-5 sm:grid-cols-2">
    <ChartShare details={chart.details} />
    <ChartDownloads subject={{ kind: SubjectKind.Chart, chart }} {wheel} />
  </div>
</div>
