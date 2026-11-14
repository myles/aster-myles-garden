<!-- A composite: one chart for two people, made from the midpoints of
     their positions, with its own houses, positions and aspects. -->
<script lang="ts">
  import AspectTable from "@/components/AspectTable.svelte";
  import ChartDownloads from "@/components/ChartDownloads.svelte";
  import ChartShare from "@/components/ChartShare.svelte";
  import ChartWheel from "@/components/ChartWheel.svelte";
  import ComparedPeople from "@/components/ComparedPeople.svelte";
  import PositionsTable from "@/components/PositionsTable.svelte";
  import type { Composite } from "@/lib/composite";
  import { SubjectKind } from "@/lib/export";
  import { describeHouseFallback, HOUSE_SYSTEM_NAMES } from "@/lib/houses";
  import { ComparisonStyle } from "@/lib/synastry";

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
  <h2 class="font-serif text-2xl" tabindex="-1">Composite chart</h2>
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
    <p class="border-rule bg-panel mt-4 rounded-md border p-3 text-sm">
      {fallbackNote}
    </p>
  {/if}

  {#if !composite.houses}
    <p class="border-rule bg-panel mt-4 rounded-md border p-3 text-sm">
      A composite's houses and angles come from both midheavens, so it needs
      both birth times. Without them it has none. A noon chart's Moon may be up
      to 7° either side of where it's shown, so the composite Moon may be up to
      3½° out for each chart without a time.
    </p>
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
