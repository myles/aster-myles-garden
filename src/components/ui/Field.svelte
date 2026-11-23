<!-- A labelled form control, with an optional hint under it. The control
     goes in as children, with the id the label names. Help, such as a
     guide toggle, sits beside the label. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    id,
    label,
    optional = false,
    hint,
    class: className = "",
    children,
    help,
  }: {
    /** The id of the control the label is for. */
    id: string;
    label: string;
    /** Marks the label "(optional)". */
    optional?: boolean;
    hint?: string;
    class?: string;
    children: Snippet;
    help?: Snippet;
  } = $props();
</script>

<div class="ui-field {className}">
  {#if help}
    <div class="flex flex-wrap items-center gap-x-1">
      {@render fieldLabel()}
      {@render help()}
    </div>
  {:else}
    {@render fieldLabel()}
  {/if}
  {@render children()}
  {#if hint}
    <p class="ui-hint">{hint}</p>
  {/if}
</div>

{#snippet fieldLabel()}
  <label for={id} class="ui-label">
    {label}
    {#if optional}
      <span class="text-ink-muted font-normal">(optional)</span>
    {/if}
  </label>
{/snippet}
