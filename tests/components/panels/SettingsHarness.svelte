<!-- The chart settings with a guide, as App provides one. -->
<script lang="ts">
  import { setGuide, type GuideEntries } from "@/components/guide/topics";
  import ChartSettingsFields from "@/components/panels/ChartSettingsFields.svelte";
  import { TROPICAL } from "@/components/panels/zodiac";
  import { AspectSet, OrbSize } from "@/lib/astrology/aspects";
  import { HouseSystem } from "@/lib/astrology/houses";

  let { guide }: { guide: GuideEntries } = $props();

  // svelte-ignore state_referenced_locally
  setGuide(guide);
</script>

<ChartSettingsFields
  houseSystem={HouseSystem.Placidus}
  zodiac={TROPICAL}
  aspectSet={AspectSet.Major}
  orbSize={OrbSize.Standard}
  isHouseSystemUnused={false}
  note=""
  onchange={() => {}}
/>
