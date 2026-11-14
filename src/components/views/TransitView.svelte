<!-- Transits: your natal chart inside a bi-wheel, the sky at the chosen
     moment around it, and the aspects the transiting planets make to
     yours. -->
<script lang="ts">
  import ChartDownloads from "@/components/chart/ChartDownloads.svelte";
  import ChartShare from "@/components/chart/ChartShare.svelte";
  import ChartWheel from "@/components/chart/ChartWheel.svelte";
  import PositionsTable from "@/components/chart/PositionsTable.svelte";
  import { ASPECT_INFO } from "@/lib/astrology/aspects";
  import { BODY_INFO } from "@/lib/astrology/bodies";
  import { SubjectKind } from "@/lib/downloads/export";
  import { formatBirthDate, formatDegrees, formatInstant } from "@/lib/format";
  import { formatPlace } from "@/lib/places";
  import {
    TRANSIT_MAX_ORB_DEGREES,
    type Transits,
  } from "@/lib/charts/transits";

  let { transits, timeZone }: { transits: Transits; timeZone: string } =
    $props();

  let wheel: SVGSVGElement | undefined = $state();

  const biWheel = $derived({
    inner: transits.natal,
    outerBodies: transits.bodies,
    aspects: transits.aspects,
    title: "Transit wheel",
    innerLabel: "Your natal",
    outerLabel: "Transiting",
  });
</script>

<div>
  <h2 class="font-serif text-2xl" tabindex="-1">Transits</h2>
  <p class="text-ink-muted mt-1 text-sm">
    {formatInstant(transits.at, timeZone)} · against your chart for
    {formatPlace(transits.natal.details.place)},
    {formatBirthDate(transits.natal)}
  </p>
  <p class="text-ink-muted mt-2 text-sm">
    Your natal planets sit inside the zodiac; the planets at this moment, in
    <span class="text-accent font-medium">this colour</span>, sit outside it.
    Transits count within {TRANSIT_MAX_ORB_DEGREES}° of exact.
  </p>

  {#if !transits.natal.houses}
    <p class="border-rule bg-panel mt-4 rounded-md border p-3 text-sm">
      Without a birth time, your chart has no houses, so the transiting planets
      can't be placed in them.
    </p>
  {/if}

  <ChartWheel chart={transits.natal} {biWheel} bind:svg={wheel} />

  <div>
    <h3 class="mb-2 font-serif text-lg">Transits to your chart</h3>
    <table class="w-full text-sm">
      <thead class="text-ink-muted text-left">
        <tr class="border-rule border-b">
          <th scope="col" class="py-1.5 font-normal">Transiting</th>
          <th scope="col" class="py-1.5 font-normal">Aspect</th>
          <th scope="col" class="py-1.5 font-normal">Natal</th>
          <th scope="col" class="py-1.5 text-right font-normal">Orb</th>
        </tr>
      </thead>
      <tbody>
        {#each transits.aspects as aspect (`${aspect.first}-${aspect.second}`)}
          {@const natal = BODY_INFO[aspect.first]}
          {@const transiting = BODY_INFO[aspect.second]}
          {@const info = ASPECT_INFO[aspect.type]}
          <tr class="border-rule/60 border-b">
            <td class="py-1.5">{transiting.glyph} {transiting.name}</td>
            <td class="py-1.5">{info.glyph} {info.name}</td>
            <td class="py-1.5">{natal.glyph} {natal.name}</td>
            <td class="py-1.5 text-right tabular-nums">
              {formatDegrees(aspect.orbDegrees)}
            </td>
          </tr>
        {:else}
          <tr class="border-rule/60 border-b">
            <td class="py-1.5" colspan="4">No transits within orb.</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="mt-8">
    <PositionsTable
      chart={{ bodies: transits.bodies, houses: undefined }}
      title="Transiting positions"
      overlay={{ heading: "Your house", houses: transits.inNatalHouses }}
    />
  </div>

  <div class="border-rule mt-10 grid gap-8 border-t pt-5 sm:grid-cols-2">
    <ChartShare
      details={transits.natal.details}
      addition={{ transitsAt: transits.at }}
    />
    <ChartDownloads
      subject={{ kind: SubjectKind.Transits, transits }}
      {wheel}
    />
  </div>
</div>
