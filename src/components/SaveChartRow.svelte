<!-- Saves a form's birth details under a name, in this browser only. Lives
     inside the birth form, so it can't be a form itself; Enter in the name
     field saves rather than drawing the chart. -->
<script lang="ts">
  import { MAX_NAME_CHARS } from "@/lib/saved-charts";

  let {
    idPrefix,
    blockedReason,
    onSave,
  }: {
    idPrefix: string;
    /** Why saving can't work here at all, e.g. storage is blocked. */
    blockedReason?: string;
    /** Saves under the name; returns why it couldn't, or undefined. */
    onSave: (name: string) => string | undefined;
  } = $props();

  let name = $state("");
  let status = $state("");
  let error = $state("");

  function save(): void {
    status = "";
    error = onSave(name) ?? "";

    if (!error) {
      status = `Saved “${name.trim()}”.`;
      name = "";
    }
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    save();
  }
</script>

<div class="border-rule flex flex-col gap-1.5 border-t pt-4">
  <label for={`${idPrefix}-save-name`} class="text-sm font-medium">
    Save as
  </label>
  <div class="flex gap-2">
    <input
      id={`${idPrefix}-save-name`}
      type="text"
      maxlength={MAX_NAME_CHARS}
      placeholder="e.g. Me"
      autocomplete="off"
      class="border-rule bg-paper min-w-0 flex-1 rounded border px-3 py-1.5 text-sm disabled:opacity-50"
      disabled={Boolean(blockedReason)}
      bind:value={name}
      onkeydown={onKeyDown}
    />
    <button
      type="button"
      class="border-rule hover:bg-accent/10 rounded border px-3 py-1.5 text-sm disabled:opacity-50"
      disabled={Boolean(blockedReason)}
      onclick={save}
    >
      Save
    </button>
  </div>
  {#if blockedReason}
    <p class="text-xs text-[var(--challenging)]">{blockedReason}</p>
  {:else}
    <p class="text-ink-muted text-xs" aria-live="polite">
      {status || "Saved in this browser only."}
    </p>
  {/if}
  <p
    role="alert"
    class="text-xs text-[var(--challenging)]"
    hidden={error.length === 0}
  >
    {error}
  </p>
</div>
