<!-- A lunar return: the chart for the moment the Moon gets back to its
     natal position, about every 27 days, cast where you are then. -->
<script lang="ts">
  import ReturnView from "@/components/views/ReturnView.svelte";
  import { Body } from "@/lib/astrology/bodies";
  import type { LunarReturn } from "@/lib/charts/lunar-return";
  import { ReturnStyle } from "@/lib/charts/returns";
  import { SubjectKind } from "@/lib/downloads/export";
  import { formatLocalDate } from "@/lib/format";

  let {
    lunarReturn,
    style = $bindable(ReturnStyle.Standalone),
  }: { lunarReturn: LunarReturn; style?: ReturnStyle } = $props();
</script>

<ReturnView
  natal={lunarReturn.natal}
  chart={lunarReturn.chart}
  bind:style
  name="Lunar return"
  heading={`Lunar return, ${formatLocalDate(lunarReturn.chart.details.date)}`}
  readFor="the month until the next return, about 27 days later."
  returningBody={Body.Moon}
  share={(chosen) => ({
    lunarReturn: {
      date: lunarReturn.chart.details.date,
      place: lunarReturn.chart.details.place,
      style: chosen,
    },
  })}
  download={(chosen) => ({
    kind: SubjectKind.LunarReturn,
    lunarReturn,
    style: chosen,
  })}
/>
