<!-- Two charts compared: a bi-wheel with your chart inside and theirs
     outside, the aspects between them, and each person's positions with
     where their planets fall in the other's houses. -->
<script lang="ts">
  import HelpToggle from "@/components/guide/HelpToggle.svelte";
  import { GuideTopic } from "@/components/guide/topics";
  import Callout from "@/components/ui/Callout.svelte";
  import ZodiacNote from "@/components/chart/ZodiacNote.svelte";
  import ChartDownloads from "@/components/chart/ChartDownloads.svelte";
  import ChartShare from "@/components/chart/ChartShare.svelte";
  import ChartWheel from "@/components/chart/ChartWheel.svelte";
  import ComparedPeople from "@/components/chart/ComparedPeople.svelte";
  import PositionsTable from "@/components/chart/PositionsTable.svelte";
  import { ASPECT_INFO } from "@/lib/astrology/aspects";
  import { BODY_INFO } from "@/lib/astrology/bodies";
  import { usesFallbackHouses } from "@/lib/charts/chart";
  import { SubjectKind } from "@/lib/downloads/export";
  import { formatDegrees, formatNoAspects } from "@/lib/format";
  import {
    describeHouseFallback,
    HOUSE_SYSTEM_NAMES,
  } from "@/lib/astrology/houses";
  import type { Synastry } from "@/lib/charts/synastry";

  let { synastry }: { synastry: Synastry } = $props();

  let wheel: SVGSVGElement | undefined = $state();

  const biWheel = $derived({
    inner: synastry.first,
    outerBodies: synastry.second.bodies,
    aspects: synastry.aspects,
    title: "Chart comparison wheel",
    innerLabel: "Your",
    outerLabel: "Their",
  });

  const people = $derived([
    { chart: synastry.first, subject: "your chart uses" },
    { chart: synastry.second, subject: "their chart uses" },
  ]);

  // The overlays use your houses, so the label follows your chart's.
  const houseSystem = $derived(
    synastry.first.houses?.houseSystem ?? synastry.first.details.houseSystem,
  );

  // Each person can be at a different latitude, so each may fall back.
  const fallbackNotes = $derived(
    people
      .filter(({ chart }) => usesFallbackHouses(chart))
      .map(({ chart, subject }) =>
        describeHouseFallback(
          chart.details.houseSystem,
          chart.houses!.houseSystem,
          subject,
        ),
      ),
  );

  const isMissingTime = $derived(
    !synastry.first.houses || !synastry.second.houses,
  );
</script>

<div>
  <div class="flex flex-wrap items-center gap-x-2">
    <h2 class="ui-heading-view" tabindex="-1">Chart comparison</h2>
    <HelpToggle topic={GuideTopic.Comparison} />
  </div>
  <ZodiacNote chart={synastry.first} />
  <ComparedPeople first={synastry.first} second={synastry.second} />
  <p class="text-ink-muted mt-2 text-sm">
    {HOUSE_SYSTEM_NAMES[houseSystem]} houses. Your planets sit inside the zodiac;
    theirs, in
    <span class="text-accent font-medium">this colour</span>, sit outside it.
  </p>

  {#each fallbackNotes as note (note)}
    <Callout class="mt-4">
      {note}
    </Callout>
  {/each}

  {#if isMissingTime}
    <Callout class="mt-4">
      A chart without a birth time is cast for noon and has no houses, so
      neither person's planets can be placed in its houses. Its Moon may be up
      to 7° either side of where it's shown, which can shift the Moon's aspects.
    </Callout>
  {/if}

  <ChartWheel chart={synastry.first} {biWheel} bind:svg={wheel} />

  <div>
    <h3 class="ui-heading-section mb-2">Aspects between you</h3>
    <table class="ui-table">
      <thead>
        <tr>
          <th scope="col">Yours</th>
          <th scope="col">Aspect</th>
          <th scope="col">Theirs</th>
          <th scope="col" class="text-right">Orb</th>
        </tr>
      </thead>
      <tbody>
        {#each synastry.aspects as aspect (`${aspect.first}-${aspect.second}`)}
          {@const yours = BODY_INFO[aspect.first]}
          {@const theirs = BODY_INFO[aspect.second]}
          {@const info = ASPECT_INFO[aspect.type]}
          <tr>
            <td>{yours.glyph} {yours.name}</td>
            <td>{info.glyph} {info.name}</td>
            <td>{theirs.glyph} {theirs.name}</td>
            <td class="text-right tabular-nums">
              {formatDegrees(aspect.orbDegrees)}
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="4">
              {formatNoAspects(synastry.first.details.aspectSettings)} between you.
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="mt-8 grid gap-8 xl:grid-cols-2">
    <PositionsTable
      chart={synastry.first}
      title="Your positions"
      overlay={{ heading: "Their house", houses: synastry.firstInSecondHouses }}
    />
    <PositionsTable
      chart={synastry.second}
      title="Their positions"
      overlay={{ heading: "Your house", houses: synastry.secondInFirstHouses }}
    />
  </div>

  <div class="border-rule mt-10 grid gap-8 border-t pt-5 sm:grid-cols-2">
    <ChartShare
      details={synastry.first.details}
      addition={{ comparedWith: synastry.second.details }}
    />
    <ChartDownloads
      subject={{ kind: SubjectKind.Comparison, synastry }}
      {wheel}
    />
  </div>
</div>
