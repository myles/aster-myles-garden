<!-- A <select> in the page's style. The options go in as children; bind
     value as with a plain <select>. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLSelectAttributes } from "svelte/elements";

  let {
    value = $bindable(),
    class: className = "",
    children,
    ...rest
  }: HTMLSelectAttributes & { children: Snippet } = $props();
</script>

<select class="ui-input {className}" bind:value {...rest}>
  {@render children()}
</select>
