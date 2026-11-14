<!-- Progressions: your natal chart inside a bi-wheel, the progressed
     planets around it, and the aspects they make to yours. -->
<script lang="ts">
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
    formatLocalDate,
  } from "@/lib/format";
  import { formatPlace } from "@/lib/places";
  import {
    PROGRESSION_MAX_ORB_DEGREES,
    type Progressions,
  } from "@/lib/charts/progressions";

  let { progressions }: { progressions: Progressions } = $props();

  let wheel: SVGSVGElement | undefined = $state();

  const biWheel = $derived({
    inner: progressions.natal,
    outerBodies: progressions.bodies,
    aspects: progressions.aspects,
    title: "Progressed wheel",
    innerLabel: "Your natal",
    outerLabel: "Progressed",
  });
</script>

<div>
  <h2 class="font-serif text-2xl" tabindex="-1">Progressions</h2>
  <p class="text-ink-muted mt-1 text-sm">
    Progressed to {formatLocalDate(progressions.forDate)} · against your chart for
    {formatPlace(progressions.natal.details.place)},
    {formatBirthDate(progressions.natal)}
  </p>
  <p class="text-ink-muted mt-2 text-sm">
    Your natal planets sit inside the zodiac; the progressed planets, a day
    after birth for each year of life, in
    <span class="text-accent font-medium">this colour</span>, sit outside it.
    Progressions count within {PROGRESSION_MAX_ORB_DEGREES}° of exact.
  </p>

  {#if !progressions.natal.details.time}
    <p class="border-rule bg-panel mt-4 rounded-md border p-3 text-sm">
      Without a birth time, your chart has no houses, so the progressed planets
      can't be placed in them. The Moon moves about 13° a day, so the progressed
      Moon could be up to 7° from where it's shown.
    </p>
  {/if}

  <ChartWheel chart={progressions.natal} {biWheel} bind:svg={wheel} />

  <div>
    <h3 class="mb-2 font-serif text-lg">Progressions to your chart</h3>
    <table class="w-full text-sm">
      <thead class="text-ink-muted text-left">
        <tr class="border-rule border-b">
          <th scope="col" class="py-1.5 font-normal">Progressed</th>
          <th scope="col" class="py-1.5 font-normal">Aspect</th>
          <th scope="col" class="py-1.5 font-normal">Natal</th>
          <th scope="col" class="py-1.5 text-right font-normal">Orb</th>
        </tr>
      </thead>
      <tbody>
        {#each progressions.aspects as aspect (`${aspect.first}-${aspect.second}`)}
          {@const natal = BODY_INFO[aspect.first]}
          {@const progressed = BODY_INFO[aspect.second]}
          {@const info = ASPECT_INFO[aspect.type]}
          <tr class="border-rule/60 border-b">
            <td class="py-1.5">{progressed.glyph} {progressed.name}</td>
            <td class="py-1.5">{info.glyph} {info.name}</td>
            <td class="py-1.5">{natal.glyph} {natal.name}</td>
            <td class="py-1.5 text-right tabular-nums">
              {formatDegrees(aspect.orbDegrees)}
            </td>
          </tr>
        {:else}
          <tr class="border-rule/60 border-b">
            <td class="py-1.5" colspan="4">No progressions within orb.</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="mt-8">
    <PositionsTable
      chart={{ bodies: progressions.bodies, houses: undefined }}
      title="Progressed positions"
      overlay={{ heading: "Your house", houses: progressions.inNatalHouses }}
    />
  </div>

  <div class="border-rule mt-10 grid gap-8 border-t pt-5 sm:grid-cols-2">
    <ChartShare
      details={progressions.natal.details}
      addition={{ progressionsForDate: progressions.forDate }}
    />
    <ChartDownloads
      subject={{ kind: SubjectKind.Progressions, progressions }}
      {wheel}
    />
  </div>
</div>
