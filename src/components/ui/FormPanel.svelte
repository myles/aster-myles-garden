<!-- A form in a bordered panel, named for screen readers by its title.
     Browser validation is off: the page explains problems itself. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLFormAttributes } from "svelte/elements";

  let {
    title,
    showTitle = true,
    description,
    children,
    ...rest
  }: HTMLFormAttributes & {
    /** Names the form, and heads it unless showTitle is false. */
    title: string;
    showTitle?: boolean;
    /** A line under the title. */
    description?: Snippet;
    children: Snippet;
  } = $props();
</script>

<form aria-label={title} class="ui-panel" novalidate {...rest}>
  {#if showTitle}
    <div>
      <h2 class="ui-heading-section">{title}</h2>
      {#if description}
        <p class="ui-hint">{@render description()}</p>
      {/if}
    </div>
  {/if}
  {@render children()}
</form>
