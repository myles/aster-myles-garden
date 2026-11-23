<!-- A chart's positions: each body's sign and house, plus the angles. In a
     comparison, an overlay adds the house each body falls in on the other
     person's chart. -->
<script lang="ts">
  import HelpToggle from "@/components/guide/HelpToggle.svelte";
  import { GuideTopic } from "@/components/guide/topics";
  import { BODY_INFO } from "@/lib/astrology/bodies";
  import type { Chart } from "@/lib/charts/chart";
  import { formatPlacement } from "@/lib/format";
  import type { HouseOverlay } from "@/lib/astrology/houses";
  import { formatLongitude } from "@/lib/astrology/zodiac";

  let {
    chart,
    title,
    overlay,
  }: {
    // Only bodies and houses are read, so the sky at a moment fits too.
    chart: Pick<Chart, "bodies" | "houses">;
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
  <div class="mb-2 flex flex-wrap items-center gap-x-2">
    <h3 class="ui-heading-section">{title}</h3>
    <HelpToggle topic={GuideTopic.Positions} />
  </div>
  <table class="ui-table">
    <thead>
      <tr>
        <th scope="col">Body</th>
        <th scope="col">Position</th>
        {#if chart.houses}
          <th scope="col" class="text-right">House</th>
        {/if}
        {#if overlay && overlayHouses}
          <th scope="col" class="text-right">
            {overlay.heading}
          </th>
        {/if}
      </tr>
    </thead>
    <tbody>
      {#each chart.bodies as placed (placed.body)}
        {@const info = BODY_INFO[placed.body]}
        <tr>
          <td>{info.glyph} {info.name}</td>
          <td>{formatPlacement(placed)}</td>
          {#if chart.houses}
            <td class="text-right tabular-nums">{placed.house}</td>
          {/if}
          {#if overlayHouses}
            <td class="text-right tabular-nums">
              {overlayHouses[placed.body]}
            </td>
          {/if}
        </tr>
      {/each}
      {#each angles as angle (angle.name)}
        <tr>
          <td>{angle.name}</td>
          <td>{formatLongitude(angle.longitude)}</td>
          <td></td>
          {#if overlayHouses}
            <td></td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
