<!-- Buttons side by side, wrapping on a narrow screen. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();
</script>

<div class="ui-button-row">
  {@render children()}
</div>
