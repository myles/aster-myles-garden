<!-- A "?" beside a label or heading that opens its guide topic. Place it
     in a flex-wrap row: the explanation takes a line of its own below.
     Given a panelId, it opens that HelpPanel instead, placed by the
     caller, as in the settings grid where a cell is too narrow. -->
<script lang="ts">
  import HelpPanel from "@/components/guide/HelpPanel.svelte";
  import { getGuide, type GuideTopic } from "@/components/guide/topics";

  let {
    topic,
    panelId,
    isOpen = $bindable(false),
  }: {
    topic: GuideTopic;
    /** The id of a HelpPanel elsewhere, which the caller opens. */
    panelId?: string;
    isOpen?: boolean;
  } = $props();

  const entry = $derived(getGuide()?.[topic]);
  const ownPanelId = $props.id();
</script>

{#if entry}
  <button
    type="button"
    class="ui-help-toggle"
    aria-label={`About ${entry.title}`}
    aria-expanded={isOpen}
    aria-controls={panelId ?? ownPanelId}
    onclick={() => (isOpen = !isOpen)}
  >
    ?
  </button>
  {#if !panelId}
    <HelpPanel
      id={ownPanelId}
      topic={isOpen ? topic : undefined}
      class="basis-full"
    />
  {/if}
{/if}
