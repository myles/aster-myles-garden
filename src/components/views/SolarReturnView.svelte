<!-- A solar return: the chart for the moment the Sun gets back to its natal
     position, cast where you are that year. -->
<script lang="ts">
  import ReturnView from "@/components/views/ReturnView.svelte";
  import { Body } from "@/lib/astrology/bodies";
  import { ReturnStyle } from "@/lib/charts/returns";
  import type { SolarReturn } from "@/lib/charts/solar-return";
  import { SubjectKind } from "@/lib/downloads/export";

  let {
    solarReturn,
    style = $bindable(ReturnStyle.Standalone),
  }: { solarReturn: SolarReturn; style?: ReturnStyle } = $props();
</script>

<ReturnView
  natal={solarReturn.natal}
  chart={solarReturn.chart}
  bind:style
  name="Solar return"
  heading={`Solar return ${solarReturn.year}`}
  readFor="the year until the next return."
  returningBody={Body.Sun}
  share={(chosen) => ({
    solarReturn: {
      year: solarReturn.year,
      place: solarReturn.chart.details.place,
      style: chosen,
    },
  })}
  download={(chosen) => ({
    kind: SubjectKind.SolarReturn,
    solarReturn,
    style: chosen,
  })}
/>
