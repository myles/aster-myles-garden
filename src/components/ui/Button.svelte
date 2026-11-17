<!-- A button in one of the page's styles. Anything else, such as onclick
     or disabled, passes through to the <button>. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  type Variant = "primary" | "secondary" | "action" | "tool" | "quiet";

  let {
    variant = "secondary",
    size = "normal",
    type = "button",
    class: className = "",
    children,
    ...rest
  }: HTMLButtonAttributes & {
    /**
     * primary: the form's one main action. secondary: alongside it.
     * action: a large choice on its own. tool: beside the wheel and its
     * tables. quiet: reads as a link.
     */
    variant?: Variant;
    /** small fits a secondary button into a row with other controls. */
    size?: "normal" | "small";
    children: Snippet;
  } = $props();
</script>

<button
  {type}
  class={[
    "ui-button",
    `ui-button--${variant}`,
    size === "small" && "ui-button--small",
    className,
  ]}
  {...rest}
>
  {@render children()}
</button>
