<!-- Transits: your natal chart inside a bi-wheel, the sky at the chosen
     moment around it, and the aspects the transiting planets make to
     yours, with when each is exact and in orb. -->
<script lang="ts">
  import Callout from "@/components/ui/Callout.svelte";
  import ZodiacNote from "@/components/chart/ZodiacNote.svelte";
  import ChartDownloads from "@/components/chart/ChartDownloads.svelte";
  import ChartShare from "@/components/chart/ChartShare.svelte";
  import ChartWheel from "@/components/chart/ChartWheel.svelte";
  import PositionsTable from "@/components/chart/PositionsTable.svelte";
  import { ASPECT_INFO } from "@/lib/astrology/aspects";
  import { BODY_INFO } from "@/lib/astrology/bodies";
  import { SubjectKind } from "@/lib/downloads/export";
  import {
    formatBirthDate,
    formatDegrees,
    formatInstant,
    formatOrbSpan,
    formatShortMoment,
  } from "@/lib/format";
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
  <h2 class="ui-heading-view" tabindex="-1">Transits</h2>
  <p class="text-ink-muted mt-1 text-sm">
    {formatInstant(transits.at, timeZone)} · against your chart for
    {formatPlace(transits.natal.details.place)},
    {formatBirthDate(transits.natal)}
  </p>
  <ZodiacNote chart={transits.natal} />
  <p class="text-ink-muted mt-2 text-sm">
    Your natal planets sit inside the zodiac; the planets at this moment, in
    <span class="text-accent font-medium">this colour</span>, sit outside it.
    Transits count within {TRANSIT_MAX_ORB_DEGREES}° of exact. A planet that
    turns retrograde can be exact more than once while in orb. Times are on your
    clock.
  </p>

  {#if !transits.natal.houses}
    <Callout class="mt-4">
      Without a birth time, your chart has no houses, so the transiting planets
      can't be placed in them.
    </Callout>
  {/if}

  <ChartWheel chart={transits.natal} {biWheel} bind:svg={wheel} />

  <div>
    <h3 class="ui-heading-section mb-2">Transits to your chart</h3>
    <div class="overflow-x-auto">
      <table class="ui-table whitespace-nowrap [&_td]:pr-3 [&_th]:pr-3">
        <thead>
          <tr>
            <th scope="col">Transiting</th>
            <th scope="col">Aspect</th>
            <th scope="col">Natal</th>
            <th scope="col" class="text-right">Orb</th>
            <th scope="col" class="pl-4">Exact</th>
            <th scope="col" class="pl-4">In orb</th>
          </tr>
        </thead>
        <tbody>
          {#each transits.aspects as aspect (`${aspect.first}-${aspect.second}`)}
            {@const natal = BODY_INFO[aspect.first]}
            {@const transiting = BODY_INFO[aspect.second]}
            {@const info = ASPECT_INFO[aspect.type]}
            <tr>
              <td>{transiting.glyph} {transiting.name}</td>
              <td>{info.glyph} {info.name}</td>
              <td>{natal.glyph} {natal.name}</td>
              <td class="text-right tabular-nums">
                {formatDegrees(aspect.orbDegrees)}
              </td>
              <td class="pl-4 whitespace-nowrap tabular-nums">
                {#each aspect.timing.exact as moment (moment.getTime())}
                  <div>{formatShortMoment(moment, timeZone)}</div>
                {:else}
                  <span class="text-ink-muted">Not this pass</span>
                {/each}
              </td>
              <td class="pl-4 whitespace-nowrap tabular-nums">
                {formatOrbSpan(aspect.timing, timeZone)}
              </td>
            </tr>
          {:else}
            <tr>
              <td colspan="6">No transits within orb.</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
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
