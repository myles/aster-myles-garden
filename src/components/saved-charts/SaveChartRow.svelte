<!-- Saves a form's birth details under a name, in this browser only. Lives
     inside the birth form, so it can't be a form itself; Enter in the name
     field saves rather than drawing the chart. -->
<script lang="ts">
  import Button from "@/components/ui/Button.svelte";
  import Input from "@/components/ui/Input.svelte";
  import Field from "@/components/ui/Field.svelte";
  import { MAX_NAME_CHARS } from "@/lib/storage/saved-charts";

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

<Field
  id={`${idPrefix}-save-name`}
  label="Save as"
  class="border-rule border-t pt-4"
>
  <div class="flex gap-2">
    <Input
      size="small"
      class="min-w-0 flex-1"
      id={`${idPrefix}-save-name`}
      type="text"
      maxlength={MAX_NAME_CHARS}
      placeholder="e.g. Me"
      autocomplete="off"
      disabled={Boolean(blockedReason)}
      bind:value={name}
      onkeydown={onKeyDown}
    />
    <Button size="small" disabled={Boolean(blockedReason)} onclick={save}>
      Save
    </Button>
  </div>
  {#if blockedReason}
    <p class="text-challenging text-xs">{blockedReason}</p>
  {:else}
    <p class="ui-hint" aria-live="polite">
      {status || "Saved in this browser only."}
    </p>
  {/if}
  <p role="alert" class="text-challenging text-xs" hidden={error.length === 0}>
    {error}
  </p>
</Field>
