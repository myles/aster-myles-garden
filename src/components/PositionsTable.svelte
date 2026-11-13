<!-- A chart's positions: each body's sign and house, plus the angles. In a
     comparison, an overlay adds the house each body falls in on the other
     person's chart. -->
<script lang="ts">
  import { BODY_INFO } from "@/lib/bodies";
  import type { Chart } from "@/lib/chart";
  import { formatPlacement } from "@/lib/format";
  import type { HouseOverlay } from "@/lib/synastry";
  import { formatLongitude } from "@/lib/zodiac";

  let {
    chart,
    title,
    overlay,
  }: {
    chart: Chart;
    title: string;
    overlay?: { heading: string; houses?: HouseOverlay };
  } = $props();

  const overlayHouses = $derived(overlay?.houses);

  const angles = $derived(
    chart.houses
      ? [
          { name: "Ascendant", longitude: chart.houses.ascendant },
          { name: "Midheaven", longitude: chart.houses.midheaven },
        ]
      : [],
  );
</script>

<div>
  <h3 class="mb-2 font-serif text-lg">{title}</h3>
  <table class="w-full text-sm">
    <thead class="text-ink-muted text-left">
      <tr class="border-rule border-b">
        <th scope="col" class="py-1.5 font-normal">Body</th>
        <th scope="col" class="py-1.5 font-normal">Position</th>
        {#if chart.houses}
          <th scope="col" class="py-1.5 text-right font-normal">House</th>
        {/if}
        {#if overlay && overlayHouses}
          <th scope="col" class="py-1.5 text-right font-normal">
            {overlay.heading}
          </th>
        {/if}
      </tr>
    </thead>
    <tbody>
      {#each chart.bodies as placed (placed.body)}
        {@const info = BODY_INFO[placed.body]}
        <tr class="border-rule/60 border-b">
          <td class="py-1.5">{info.glyph} {info.name}</td>
          <td class="py-1.5">{formatPlacement(placed)}</td>
          {#if chart.houses}
            <td class="py-1.5 text-right tabular-nums">{placed.house}</td>
          {/if}
          {#if overlayHouses}
            <td class="py-1.5 text-right tabular-nums">
              {overlayHouses[placed.body]}
            </td>
          {/if}
        </tr>
      {/each}
      {#each angles as angle (angle.name)}
        <tr class="border-rule/60 border-b">
          <td class="py-1.5">{angle.name}</td>
          <td class="py-1.5">{formatLongitude(angle.longitude)}</td>
          <td class="py-1.5"></td>
          {#if overlayHouses}
            <td class="py-1.5"></td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
