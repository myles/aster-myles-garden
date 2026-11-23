<!-- A composite: one chart for two people, made from the midpoints of
     their positions, with its own houses, positions and aspects. -->
<script lang="ts">
  import HelpToggle from "@/components/guide/HelpToggle.svelte";
  import { GuideTopic } from "@/components/guide/topics";
  import Callout from "@/components/ui/Callout.svelte";
  import ZodiacNote from "@/components/chart/ZodiacNote.svelte";
  import AspectTable from "@/components/chart/AspectTable.svelte";
  import ChartDownloads from "@/components/chart/ChartDownloads.svelte";
  import ChartShare from "@/components/chart/ChartShare.svelte";
  import ChartWheel from "@/components/chart/ChartWheel.svelte";
  import ComparedPeople from "@/components/chart/ComparedPeople.svelte";
  import PositionsTable from "@/components/chart/PositionsTable.svelte";
  import type { Composite } from "@/lib/charts/composite";
  import { SubjectKind } from "@/lib/downloads/export";
  import {
    describeHouseFallback,
    HOUSE_SYSTEM_NAMES,
  } from "@/lib/astrology/houses";
  import { ComparisonStyle } from "@/lib/charts/synastry";

  let { composite }: { composite: Composite } = $props();

  let wheel: SVGSVGElement | undefined = $state();

  const requestedSystem = $derived(composite.first.details.houseSystem);

  const fallbackNote = $derived(
    composite.houses && composite.houses.houseSystem !== requestedSystem
      ? describeHouseFallback(
          requestedSystem,
          composite.houses.houseSystem,
          "the composite uses",
        )
      : undefined,
  );
</script>

<div>
  <div class="flex flex-wrap items-center gap-x-2">
    <h2 class="ui-heading-view" tabindex="-1">Composite chart</h2>
    <HelpToggle topic={GuideTopic.Composite} />
  </div>
  <ZodiacNote chart={composite.first} />
  <ComparedPeople first={composite.first} second={composite.second} />
  <p class="text-ink-muted mt-2 text-sm">
    One chart for the two of you: each planet sits at the midpoint of yours and
    theirs.
    {#if composite.houses}
      Its {HOUSE_SYSTEM_NAMES[composite.houses.houseSystem]} houses are cast around
      the midpoint of your midheavens, at the latitude halfway between your birthplaces.
    {/if}
  </p>

  {#if fallbackNote}
    <Callout class="mt-4">
      {fallbackNote}
    </Callout>
  {/if}

  {#if !composite.houses}
    <Callout class="mt-4">
      A composite's houses and angles come from both midheavens, so it needs
      both birth times. Without them it has none. A noon chart's Moon may be up
      to 7° either side of where it's shown, so the composite Moon may be up to
      3½° out for each chart without a time.
    </Callout>
  {/if}

  <ChartWheel
    chart={composite}
    title="Composite chart wheel"
    bind:svg={wheel}
  />

  <div class="grid gap-8 xl:grid-cols-2">
    <PositionsTable chart={composite} title="Composite positions" />

    <AspectTable
      aspects={composite.aspects}
      settings={composite.first.details.aspectSettings}
    />
  </div>

  <div class="border-rule mt-10 grid gap-8 border-t pt-5 sm:grid-cols-2">
    <ChartShare
      details={composite.first.details}
      addition={{
        comparedWith: composite.second.details,
        comparisonStyle: ComparisonStyle.Composite,
      }}
    />
    <ChartDownloads
      subject={{ kind: SubjectKind.Composite, composite }}
      {wheel}
    />
  </div>
</div>
