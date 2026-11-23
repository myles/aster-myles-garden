<!-- A guide topic's explanation, opened by a HelpToggle, with a link to
     the whole guide. Always in the page, so the toggle's aria-controls
     finds it; hidden until open. -->
<script lang="ts">
  import {
    getGuide,
    GUIDE_PATH,
    toGuideAnchor,
    type GuideTopic,
  } from "@/components/guide/topics";

  let {
    id,
    topic,
    class: className = "",
  }: {
    id: string;
    /** The open topic, or none while closed. */
    topic: GuideTopic | undefined;
    class?: string;
  } = $props();

  const entry = $derived(topic ? getGuide()?.[topic] : undefined);
</script>

<div {id} class={className} hidden={!entry}>
  {#if topic && entry}
    <div class="ui-callout ui-prose mt-2 font-normal">
      <!-- Our own Markdown, rendered at build time: never visitor input. -->
      {@html entry.html}
      <p>
        <a href={`${GUIDE_PATH}#${toGuideAnchor(topic)}`}>More in the guide</a>
      </p>
    </div>
  {/if}
</div>
