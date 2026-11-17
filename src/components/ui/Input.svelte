<!-- A text, date, time or number input in the page's style. Bind value as
     with a plain <input>; anything else passes through. -->
<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  let {
    value = $bindable(),
    element = $bindable(),
    size = "normal",
    class: className = "",
    ...rest
  }: Omit<HTMLInputAttributes, "size"> & {
    element?: HTMLInputElement;
    /** small fits into a row with a small button. */
    size?: "normal" | "small";
  } = $props();
</script>

<input
  class={["ui-input", size === "small" && "ui-input--small", className]}
  bind:value
  bind:this={element}
  {...rest}
/>
