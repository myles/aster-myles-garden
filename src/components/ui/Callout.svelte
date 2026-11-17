<!-- A boxed aside, such as a note that houses fell back near the pole. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    class: className = "",
    children,
  }: { class?: string; children: Snippet } = $props();
</script>

<p class="ui-callout {className}">
  {@render children()}
</p>
