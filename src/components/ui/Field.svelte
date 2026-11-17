<!-- A labelled form control, with an optional hint under it. The control
     goes in as children, with the id the label names. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    id,
    label,
    optional = false,
    hint,
    class: className = "",
    children,
  }: {
    /** The id of the control the label is for. */
    id: string;
    label: string;
    /** Marks the label "(optional)". */
    optional?: boolean;
    hint?: string;
    class?: string;
    children: Snippet;
  } = $props();
</script>

<div class="ui-field {className}">
  <label for={id} class="ui-label">
    {label}
    {#if optional}
      <span class="text-ink-muted font-normal">(optional)</span>
    {/if}
  </label>
  {@render children()}
  {#if hint}
    <p class="ui-hint">{hint}</p>
  {/if}
</div>
