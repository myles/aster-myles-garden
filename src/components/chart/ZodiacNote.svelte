<!-- Says a chart is sidereal, by which ayanamsa, and how far it is from
     the tropical zodiac. Nothing for a tropical chart, the default. -->
<script lang="ts">
  import { AYANAMSA_NAMES } from "@/lib/astrology/ayanamsa";
  import type { Chart } from "@/lib/charts/chart";
  import { formatDegrees } from "@/lib/format";

  let { chart }: { chart: Chart } = $props();

  // Example: "Sidereal zodiac, Lahiri ayanamsa: 23° 51′ behind the
  // tropical."
  const note = $derived.by(() => {
    const { ayanamsa } = chart.details;
    if (!ayanamsa) {
      return undefined;
    }

    const name = `Sidereal zodiac, ${AYANAMSA_NAMES[ayanamsa]} ayanamsa`;
    return chart.ayanamsaDegrees === undefined
      ? `${name}.`
      : `${name}: ${formatDegrees(chart.ayanamsaDegrees)} behind the tropical.`;
  });
</script>

{#if note}
  <p class="text-ink-muted mt-1 text-sm">{note}</p>
{/if}
