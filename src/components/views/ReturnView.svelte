<!-- A return: the chart for the moment the Sun or Moon gets back to its
     natal position, cast where you are then, with its positions and
     aspects, on its own or against your natal chart. SolarReturnView and
     LunarReturnView give it their names and words. -->
<script lang="ts">
  import Callout from "@/components/ui/Callout.svelte";
  import ZodiacNote from "@/components/chart/ZodiacNote.svelte";
  import AspectTable from "@/components/chart/AspectTable.svelte";
  import ChartDownloads from "@/components/chart/ChartDownloads.svelte";
  import ChartShare from "@/components/chart/ChartShare.svelte";
  import ChartWheel from "@/components/chart/ChartWheel.svelte";
  import PositionsTable from "@/components/chart/PositionsTable.svelte";
  import { BODY_INFO, type Body } from "@/lib/astrology/bodies";
  import type { Chart } from "@/lib/charts/chart";
  import type { ExportSubject } from "@/lib/downloads/export";
  import type { ShareAddition } from "@/lib/share";
  import { usesFallbackHouses } from "@/lib/charts/chart";
  import { formatBirthMoment } from "@/lib/format";
  import {
    describeHouseFallback,
    HOUSE_SYSTEM_NAMES,
  } from "@/lib/astrology/houses";
  import { formatPlace } from "@/lib/places";
  import { ReturnStyle } from "@/lib/charts/returns";
  import { compareCharts } from "@/lib/charts/synastry";
  import { formatLongitude } from "@/lib/astrology/zodiac";

  let {
    natal,
    chart,
    style = $bindable(ReturnStyle.Standalone),
    name,
    heading,
    returningBody,
    readFor,
    share,
    download,
  }: {
    natal: Chart;
    /** Cast for the return's moment and place. */
    chart: Chart;
    style?: ReturnStyle;
    /** "Solar return": names the wheels and the style choice. */
    name: string;
    heading: string;
    /** The body whose return it is. */
    returningBody: Body;
    /** Ends "The chart is read for …": how long until the next one. */
    readFor: string;
    /** What the share link adds to your chart, given the style. */
    share: (style: ReturnStyle) => ShareAddition;
    /** What the downloads hold, given the style. */
    download: (style: ReturnStyle) => ExportSubject;
  } = $props();

  let wheel: SVGSVGElement | undefined = $state();

  const isBiWheel = $derived(style === ReturnStyle.BiWheel);
  // Only the bi-wheel compares the return with the natal chart.
  const comparison = $derived(
    isBiWheel ? compareCharts(natal, chart) : undefined,
  );
  const biWheel = $derived(
    comparison
      ? {
          inner: natal,
          outerBodies: chart.bodies,
          aspects: comparison.aspects,
          title: `${name} comparison wheel`,
          innerLabel: "Natal",
          outerLabel: name,
        }
      : undefined,
  );

  // The bi-wheel draws the natal houses, so the labels follow those.
  const housesChart = $derived(isBiWheel ? natal : chart);

  const subheading = $derived(
    [
      formatPlace(chart.details.place),
      formatBirthMoment(chart),
      housesChart.houses && HOUSE_SYSTEM_NAMES[housesChart.houses.houseSystem],
    ]
      .filter(Boolean)
      .join(" · "),
  );

  const natalPosition = $derived(
    natal.bodies.find((placed) => placed.body === returningBody),
  );
  // "solarReturnStyle": radio groups on one page need their own names.
  const groupName = $derived(
    `${name.toLowerCase().replace(/ (\w)/g, (_, c) => c.toUpperCase())}Style`,
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
  <h2 class="ui-heading-view" tabindex="-1">{heading}</h2>
  <p class="text-ink-muted mt-1 text-sm">{subheading}</p>
  <ZodiacNote {chart} />
  {#if natalPosition}
    <p class="text-ink-muted mt-2 text-sm">
      The {BODY_INFO[returningBody].name} returns to {formatLongitude(
        natalPosition.longitude,
      )}, where it was when you were born. The chart is read for {readFor}
    </p>
  {/if}

  {#if fallbackNote}
    <Callout class="mt-4">
      {fallbackNote}
    </Callout>
  {/if}

  <fieldset class="mt-4 flex flex-wrap gap-4 text-sm">
    <legend class="ui-label mb-2">Show {name.toLowerCase()}</legend>
    <label class="flex items-center gap-2">
      <input
        type="radio"
        name={groupName}
        bind:group={style}
        value={ReturnStyle.Standalone}
      />
      Return alone
    </label>
    <label class="flex items-center gap-2">
      <input
        type="radio"
        name={groupName}
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
    title={biWheel ? undefined : `${name} chart wheel`}
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
    <ChartShare details={natal.details} addition={share(style)} />
    <ChartDownloads subject={download(style)} {wheel} />
  </div>
</div>
