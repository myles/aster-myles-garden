<!-- A lunar return: the chart for the moment the Moon gets back to its natal
     position, cast where you are then, with its positions and aspects. -->
<script lang="ts">
  import ZodiacNote from "@/components/chart/ZodiacNote.svelte";
  import AspectTable from "@/components/chart/AspectTable.svelte";
  import ChartDownloads from "@/components/chart/ChartDownloads.svelte";
  import ChartShare from "@/components/chart/ChartShare.svelte";
  import ChartWheel from "@/components/chart/ChartWheel.svelte";
  import PositionsTable from "@/components/chart/PositionsTable.svelte";
  import { Body } from "@/lib/astrology/bodies";
  import { usesFallbackHouses } from "@/lib/charts/chart";
  import { SubjectKind } from "@/lib/downloads/export";
  import { formatBirthMoment, formatLocalDate } from "@/lib/format";
  import {
    describeHouseFallback,
    HOUSE_SYSTEM_NAMES,
  } from "@/lib/astrology/houses";
  import { formatPlace } from "@/lib/places";
  import type { LunarReturn } from "@/lib/charts/lunar-return";
  import { ReturnStyle } from "@/lib/charts/returns";
  import { compareCharts } from "@/lib/charts/synastry";
  import { formatLongitude } from "@/lib/astrology/zodiac";

  let {
    lunarReturn,
    style = $bindable(ReturnStyle.Standalone),
  }: { lunarReturn: LunarReturn; style?: ReturnStyle } = $props();

  let wheel: SVGSVGElement | undefined = $state();

  const chart = $derived(lunarReturn.chart);
  const isBiWheel = $derived(style === ReturnStyle.BiWheel);
  // Only the bi-wheel compares the return with the natal chart.
  const comparison = $derived(
    isBiWheel ? compareCharts(lunarReturn.natal, chart) : undefined,
  );
  const biWheel = $derived(
    comparison
      ? {
          inner: lunarReturn.natal,
          outerBodies: chart.bodies,
          aspects: comparison.aspects,
          title: "Lunar return comparison wheel",
          innerLabel: "Natal",
          outerLabel: "Lunar return",
        }
      : undefined,
  );

  // The bi-wheel draws the natal houses, so the labels follow those.
  const housesChart = $derived(isBiWheel ? lunarReturn.natal : chart);

  const subheading = $derived(
    [
      formatPlace(chart.details.place),
      formatBirthMoment(chart),
      housesChart.houses && HOUSE_SYSTEM_NAMES[housesChart.houses.houseSystem],
    ]
      .filter(Boolean)
      .join(" · "),
  );

  const natalMoon = $derived(
    lunarReturn.natal.bodies.find((placed) => placed.body === Body.Moon),
  );

  const fallbackNote = $derived(
    housesChart.houses && usesFallbackHouses(housesChart)
      ? describeHouseFallback(
          housesChart.details.houseSystem,
          housesChart.houses.houseSystem,
          isBiWheel ? "your natal chart uses" : "the return uses",
        )
      : undefined,
  );
</script>

<div>
  <h2 class="font-serif text-2xl" tabindex="-1">
    Lunar return, {formatLocalDate(chart.details.date)}
  </h2>
  <p class="text-ink-muted mt-1 text-sm">{subheading}</p>
  <ZodiacNote {chart} />
  {#if natalMoon}
    <p class="text-ink-muted mt-2 text-sm">
      The Moon returns to {formatLongitude(natalMoon.longitude)}, where it was
      when you were born. The chart is read for the month until the next return,
      about 27 days later.
    </p>
  {/if}

  {#if fallbackNote}
    <p class="border-rule bg-panel mt-4 rounded-md border p-3 text-sm">
      {fallbackNote}
    </p>
  {/if}

  <fieldset class="mt-4 flex flex-wrap gap-4 text-sm">
    <legend class="mb-2 font-medium">Show lunar return</legend>
    <label class="flex items-center gap-2">
      <input
        type="radio"
        name="lunarReturnStyle"
        bind:group={style}
        value={ReturnStyle.Standalone}
      />
      Return alone
    </label>
    <label class="flex items-center gap-2">
      <input
        type="radio"
        name="lunarReturnStyle"
        bind:group={style}
        value={ReturnStyle.BiWheel}
      />
      Against natal chart
    </label>
  </fieldset>

  {#if isBiWheel}
    <p class="text-ink-muted mt-2 text-sm">
      Your natal chart and houses sit inside the zodiac. The return's planets,
      in <span class="text-accent font-medium">this colour</span>, sit outside.
      Lines show aspects between the natal and return planets.
    </p>
  {/if}

  <!-- The bi-wheel is named by its own title. -->
  <ChartWheel
    {chart}
    {biWheel}
    title={biWheel ? undefined : "Lunar return chart wheel"}
    bind:svg={wheel}
  />

  <div class="grid gap-8 xl:grid-cols-2">
    <PositionsTable
      {chart}
      title="Positions"
      overlay={comparison
        ? {
            heading: "Natal house",
            houses: comparison.secondInFirstHouses,
          }
        : undefined}
    />

    <AspectTable
      title={isBiWheel ? "Aspects to natal chart" : "Aspects"}
      firstLabel={isBiWheel ? "Natal" : ""}
      secondLabel={isBiWheel ? "Return" : ""}
      aspects={comparison ? comparison.aspects : chart.aspects}
      settings={chart.details.aspectSettings}
    />
  </div>

  <div class="border-rule mt-10 grid gap-8 border-t pt-5 sm:grid-cols-2">
    <ChartShare
      details={lunarReturn.natal.details}
      addition={{
        lunarReturn: {
          date: chart.details.date,
          place: chart.details.place,
          style,
        },
      }}
    />
    <ChartDownloads
      subject={{ kind: SubjectKind.LunarReturn, lunarReturn, style }}
      {wheel}
    />
  </div>
</div>
