<!-- Provides a guide, as App does, around one help toggle. -->
<script lang="ts">
  import HelpToggle from "@/components/guide/HelpToggle.svelte";
  import {
    setGuide,
    type GuideEntries,
    type GuideTopic,
  } from "@/components/guide/topics";

  let { guide, topic }: { guide?: GuideEntries; topic: GuideTopic } = $props();

  // svelte-ignore state_referenced_locally
  setGuide(guide);
</script>

<HelpToggle {topic} />
