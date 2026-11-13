<script lang="ts">
  import ChartDownloads from "@/components/ChartDownloads.svelte";
  import ChartShare from "@/components/ChartShare.svelte";
  import ChartWheel from "@/components/ChartWheel.svelte";
  import { ASPECT_INFO } from "@/lib/aspects";
  import { BODY_INFO } from "@/lib/bodies";
  import type { Chart } from "@/lib/chart";
  import { formatCoordinates, formatDegrees } from "@/lib/format";
  import { HOUSE_SYSTEM_NAMES } from "@/lib/houses";
  import { formatPlace } from "@/lib/places";
  import { formatLongitude } from "@/lib/zodiac";

  let { chart }: { chart: Chart } = $props();

  let wheel: SVGSVGElement | undefined = $state();

  const subheading = $derived(
    [
      formatBirthMoment(chart),
      formatCoordinates(
        chart.details.place.latitude,
        chart.details.place.longitude,
      ),
      HOUSE_SYSTEM_NAMES[chart.details.houseSystem],
    ].join(" · "),
  );

  const angles = $derived([
    { name: "Ascendant", longitude: chart.houses.ascendant },
    { name: "Midheaven", longitude: chart.houses.midheaven },
  ]);

  function formatBirthMoment(chart: Chart): string {
    const { timeZone } = chart.details.place;
    const local = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      dateStyle: "long",
      timeStyle: "short",
    }).format(chart.bornAt);
    // en-US knows abbreviations such as "EDT"; elsewhere it gives "GMT+1".
    const zone = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short",
    })
      .formatToParts(chart.bornAt)
      .find((part) => part.type === "timeZoneName")?.value;
    const universal = new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      timeStyle: "short",
    }).format(chart.bornAt);

    return `${local} ${zone ?? ""} (${universal} UT)`;
  }
</script>

<div>
  <h2 class="font-serif text-2xl">{formatPlace(chart.details.place)}</h2>
  <p class="text-ink-muted mt-1 text-sm">{subheading}</p>

  <ChartWheel {chart} bind:svg={wheel} />

  <div class="grid gap-8 xl:grid-cols-2">
    <div>
      <h3 class="mb-2 font-serif text-lg">Positions</h3>
      <table class="w-full text-sm">
        <thead class="text-ink-muted text-left">
          <tr class="border-rule border-b">
            <th scope="col" class="py-1.5 font-normal">Body</th>
            <th scope="col" class="py-1.5 font-normal">Position</th>
            <th scope="col" class="py-1.5 text-right font-normal">House</th>
          </tr>
        </thead>
        <tbody>
          {#each chart.bodies as placed (placed.body)}
            {@const info = BODY_INFO[placed.body]}
            <tr class="border-rule/60 border-b">
              <td class="py-1.5">{info.glyph} {info.name}</td>
              <td class="py-1.5">
                {formatLongitude(placed.longitude)}{placed.isRetrograde
                  ? " ℞"
                  : ""}
              </td>
              <td class="py-1.5 text-right tabular-nums">{placed.house}</td>
            </tr>
          {/each}
          {#each angles as angle (angle.name)}
            <tr class="border-rule/60 border-b">
              <td class="py-1.5">{angle.name}</td>
              <td class="py-1.5">{formatLongitude(angle.longitude)}</td>
              <td class="py-1.5"></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

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
              <td class="py-1.5">No major aspects within orb.</td>
              <td class="py-1.5"></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <div class="border-rule mt-10 grid gap-8 border-t pt-5 sm:grid-cols-2">
    <ChartShare details={chart.details} />
    <ChartDownloads {chart} {wheel} />
  </div>
</div>
