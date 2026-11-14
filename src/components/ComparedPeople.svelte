<!-- The two people in a comparison: where and when each was born. -->
<script lang="ts">
  import type { Chart } from "@/lib/chart";
  import { formatBirthDate, formatBirthMoment } from "@/lib/format";
  import { formatPlace } from "@/lib/places";

  let { first, second }: { first: Chart; second: Chart } = $props();

  const people = $derived([
    { label: "You", chart: first },
    { label: "Them", chart: second },
  ]);

  function describeBirth(chart: Chart): string {
    const moment = chart.details.time
      ? formatBirthMoment(chart)
      : `${formatBirthDate(chart)}, time unknown`;

    return `${formatPlace(chart.details.place)} · ${moment}`;
  }
</script>

<dl class="mt-2 flex flex-col gap-1 text-sm">
  {#each people as person (person.label)}
    <div class="flex gap-2">
      <dt class="w-12 shrink-0 font-medium">{person.label}</dt>
      <dd class="text-ink-muted">{describeBirth(person.chart)}</dd>
    </div>
  {/each}
</dl>
