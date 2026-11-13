<!-- Two charts compared: a bi-wheel with your chart inside and theirs
     outside, the aspects between them, and each person's positions with
     where their planets fall in the other's houses. -->
<script lang="ts">
  import ChartDownloads from "@/components/ChartDownloads.svelte";
  import ChartShare from "@/components/ChartShare.svelte";
  import ChartWheel from "@/components/ChartWheel.svelte";
  import PositionsTable from "@/components/PositionsTable.svelte";
  import { ASPECT_INFO } from "@/lib/aspects";
  import { BODY_INFO } from "@/lib/bodies";
  import type { Chart } from "@/lib/chart";
  import { SubjectKind } from "@/lib/export";
  import {
    formatBirthDate,
    formatBirthMoment,
    formatDegrees,
  } from "@/lib/format";
  import { HOUSE_SYSTEM_NAMES } from "@/lib/houses";
  import { formatPlace } from "@/lib/places";
  import type { Synastry } from "@/lib/synastry";

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
    { label: "You", chart: synastry.first },
    { label: "Them", chart: synastry.second },
  ]);

  const isMissingTime = $derived(
    !synastry.first.houses || !synastry.second.houses,
  );

  function describeBirth(chart: Chart): string {
    const moment = chart.details.time
      ? formatBirthMoment(chart)
      : `${formatBirthDate(chart)}, time unknown`;

    return `${formatPlace(chart.details.place)} · ${moment}`;
  }
</script>

<div>
  <h2 class="font-serif text-2xl">Chart comparison</h2>
  <dl class="mt-2 flex flex-col gap-1 text-sm">
    {#each people as person (person.label)}
      <div class="flex gap-2">
        <dt class="w-12 shrink-0 font-medium">{person.label}</dt>
        <dd class="text-ink-muted">{describeBirth(person.chart)}</dd>
      </div>
    {/each}
  </dl>
  <p class="text-ink-muted mt-2 text-sm">
    {HOUSE_SYSTEM_NAMES[synastry.first.details.houseSystem]} houses. Your planets
    sit inside the zodiac; theirs, in
    <span class="text-accent font-medium">this colour</span>, sit outside it.
  </p>

  {#if isMissingTime}
    <p class="border-rule bg-panel mt-4 rounded-md border p-3 text-sm">
      A chart without a birth time is cast for noon and has no houses, so
      neither person's planets can be placed in its houses. Its Moon may be up
      to 7° either side of where it's shown, which can shift the Moon's aspects.
    </p>
  {/if}

  <ChartWheel chart={synastry.first} {biWheel} bind:svg={wheel} />

  <div>
    <h3 class="mb-2 font-serif text-lg">Aspects between you</h3>
    <table class="w-full text-sm">
      <thead class="text-ink-muted text-left">
        <tr class="border-rule border-b">
          <th scope="col" class="py-1.5 font-normal">Yours</th>
          <th scope="col" class="py-1.5 font-normal">Aspect</th>
          <th scope="col" class="py-1.5 font-normal">Theirs</th>
          <th scope="col" class="py-1.5 text-right font-normal">Orb</th>
        </tr>
      </thead>
      <tbody>
        {#each synastry.aspects as aspect (`${aspect.first}-${aspect.second}`)}
          {@const yours = BODY_INFO[aspect.first]}
          {@const theirs = BODY_INFO[aspect.second]}
          {@const info = ASPECT_INFO[aspect.type]}
          <tr class="border-rule/60 border-b">
            <td class="py-1.5">{yours.glyph} {yours.name}</td>
            <td class="py-1.5">{info.glyph} {info.name}</td>
            <td class="py-1.5">{theirs.glyph} {theirs.name}</td>
            <td class="py-1.5 text-right tabular-nums">
              {formatDegrees(aspect.orbDegrees)}
            </td>
          </tr>
        {:else}
          <tr class="border-rule/60 border-b">
            <td class="py-1.5" colspan="4">No major aspects between you.</td>
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
