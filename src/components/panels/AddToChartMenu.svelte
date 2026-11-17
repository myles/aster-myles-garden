<!-- What can be added to your chart once it's drawn: someone else's chart,
     transits, progressions, or a solar or lunar return. -->
<script lang="ts">
  import Button from "@/components/ui/Button.svelte";

  let {
    onCompare,
    onTransits,
    onProgressions,
    onSolarReturn,
    onLunarReturn,
  }: {
    onCompare: () => void;
    onTransits: () => void;
    onProgressions: () => void;
    onSolarReturn: () => void;
    onLunarReturn: () => void;
  } = $props();
</script>

<div class="flex flex-col gap-2">
  <Button variant="action" onclick={onCompare}>Compare with someone else</Button
  >
  <Button variant="action" onclick={onTransits}>See transits</Button>
  <Button variant="action" onclick={onProgressions}>See progressions</Button>
  <Button variant="action" onclick={onSolarReturn}>See solar return</Button>
  <Button variant="action" onclick={onLunarReturn}>See lunar return</Button>
</div>
