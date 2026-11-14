<!-- A solar return: the chart for the moment the Sun gets back to its natal
     position, cast where you are that year, with its positions and aspects. -->
<script lang="ts">
  import AspectTable from "@/components/AspectTable.svelte";
  import ChartDownloads from "@/components/ChartDownloads.svelte";
  import ChartShare from "@/components/ChartShare.svelte";
  import ChartWheel from "@/components/ChartWheel.svelte";
  import PositionsTable from "@/components/PositionsTable.svelte";
  import { Body } from "@/lib/bodies";
  import { usesFallbackHouses } from "@/lib/chart";
  import { SubjectKind } from "@/lib/export";
  import { formatBirthMoment } from "@/lib/format";
  import { describeHouseFallback, HOUSE_SYSTEM_NAMES } from "@/lib/houses";
  import { formatPlace } from "@/lib/places";
  import { SolarReturnStyle, type SolarReturn } from "@/lib/solar-return";
  import { compareCharts } from "@/lib/synastry";
  import { formatLongitude } from "@/lib/zodiac";

  let {
    solarReturn,
    style = $bindable(SolarReturnStyle.Standalone),
  }: { solarReturn: SolarReturn; style?: SolarReturnStyle } = $props();

  let wheel: SVGSVGElement | undefined = $state();

  const chart = $derived(solarReturn.chart);
  const isBiWheel = $derived(style === SolarReturnStyle.BiWheel);
  const comparison = $derived(compareCharts(solarReturn.natal, chart));
  const biWheel = $derived(
    isBiWheel
      ? {
          inner: solarReturn.natal,
          outerBodies: chart.bodies,
          aspects: comparison.aspects,
          title: "Solar return comparison wheel",
          innerLabel: "Natal",
          outerLabel: "Solar return",
        }
      : undefined,
  );

  const subheading = $derived(
    [
      formatPlace(chart.details.place),
      formatBirthMoment(chart),
      chart.houses && HOUSE_SYSTEM_NAMES[chart.houses.houseSystem],
    ]
      .filter(Boolean)
      .join(" · "),
  );

  const natalSun = $derived(
    solarReturn.natal.bodies.find((placed) => placed.body === Body.Sun),
  );

  const fallbackNote = $derived(
    chart.houses && usesFallbackHouses(chart)
      ? describeHouseFallback(
          chart.details.houseSystem,
          chart.houses.houseSystem,
          "the return uses",
        )
      : undefined,
  );
</script>

<div>
  <h2 class="font-serif text-2xl" tabindex="-1">
    Solar return {solarReturn.year}
  </h2>
  <p class="text-ink-muted mt-1 text-sm">{subheading}</p>
  {#if natalSun}
    <p class="text-ink-muted mt-2 text-sm">
      The Sun returns to {formatLongitude(natalSun.longitude)}, where it was
      when you were born. The chart is read for the year until the next return.
    </p>
  {/if}

  {#if fallbackNote}
    <p class="border-rule bg-panel mt-4 rounded-md border p-3 text-sm">
      {fallbackNote}
    </p>
  {/if}

  <fieldset class="mt-4 flex flex-wrap gap-4 text-sm">
    <legend class="mb-2 font-medium">Show solar return</legend>
    <label class="flex items-center gap-2">
      <input
        type="radio"
        name="solarReturnStyle"
        bind:group={style}
        value={SolarReturnStyle.Standalone}
      />
      Return alone
    </label>
    <label class="flex items-center gap-2">
      <input
        type="radio"
        name="solarReturnStyle"
        bind:group={style}
        value={SolarReturnStyle.BiWheel}
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

  <ChartWheel
    {chart}
    {biWheel}
    title="Solar return chart wheel"
    bind:svg={wheel}
  />

  <div class="grid gap-8 xl:grid-cols-2">
    <PositionsTable
      {chart}
      title="Positions"
      overlay={isBiWheel
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
      aspects={isBiWheel ? comparison.aspects : chart.aspects}
      settings={chart.details.aspectSettings}
    />
  </div>

  <div class="border-rule mt-10 grid gap-8 border-t pt-5 sm:grid-cols-2">
    <ChartShare
      details={solarReturn.natal.details}
      addition={{
        solarReturn: {
          year: solarReturn.year,
          place: chart.details.place,
          style,
        },
      }}
    />
    <ChartDownloads
      subject={{ kind: SubjectKind.SolarReturn, solarReturn, style }}
      {wheel}
    />
  </div>
</div>
