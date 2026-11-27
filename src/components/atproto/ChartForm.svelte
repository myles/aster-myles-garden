<!-- Birth details for one chart, yours or someone else's. Reading the
     form can throw; the page runs `onsave` where it reports errors. -->
<script lang="ts">
  import { untrack } from "svelte";

  import { ChartOwner } from "@/components/atproto/owner";
  import BirthFields from "@/components/birth-form/BirthFields.svelte";
  import {
    DEFAULT_HOUSE_SYSTEM,
    HOUSE_SYSTEM_NAMES,
    HouseSystem,
  } from "@/lib/astrology/houses";
  import { TimeDisclosure, type ChartDetails } from "@/lib/atproto/record";
  import type { Place } from "@/lib/places";
  import {
    formatDateValue,
    formatTimeValue,
    parseLocalDate,
    parseLocalTime,
  } from "@/lib/time";

  export type ChartInput = {
    details: ChartDetails;
    disclosure: TimeDisclosure;
  };

  let {
    owner,
    initial,
    isBusy,
    note,
    onsave,
    oncancel,
  }: {
    owner: ChartOwner;
    /** Prefills the form; its AI preferences are carried through. */
    initial?: ChartDetails;
    isBusy: boolean;
    /** Shown above the save button, such as what a first save creates. */
    note?: string;
    onsave: (read: () => ChartInput) => void;
    oncancel?: () => void;
  } = $props();

  // The form is seeded once; later changes to `initial` don't reset it.
  const seed = untrack(() => initial);
  let name = $state(seed?.name ?? "");
  let date = $state(seed ? formatDateValue(seed.date) : "");
  let time = $state(seed?.time ? formatTimeValue(seed.time) : "");
  let isTimeUnknown = $state(seed ? !seed.time : false);
  let place: Place | undefined = $state.raw(seed?.place);
  let houseSystem = $state(seed?.houseSystem ?? DEFAULT_HOUSE_SYSTEM);
  let shouldIncludeTime = $state(false);
  let hasConsented = $state(false);

  const isPerson = $derived(owner === ChartOwner.Person);
  const idPrefix = $derived(isPerson ? "atproto-person" : "atproto");

  function readForm(): ChartInput {
    if (!hasConsented) {
      throw new Error(
        isPerson
          ? "Confirm you have their permission to store their details."
          : "Confirm these are your own birth details.",
      );
    }
    if (isPerson && !name.trim()) {
      throw new Error("Enter a name for them.");
    }
    if (!place) {
      throw new Error("Choose a place or enter its coordinates.");
    }
    return {
      details: {
        ...(isPerson && { name: name.trim() }),
        ...(seed?.aiPreferences !== undefined && {
          aiPreferences: seed.aiPreferences,
        }),
        date: parseLocalDate(date),
        time: isTimeUnknown ? undefined : parseLocalTime(time),
        place,
        houseSystem,
      },
      disclosure: shouldIncludeTime
        ? TimeDisclosure.Include
        : TimeDisclosure.Omit,
    };
  }

  function submit(event: SubmitEvent): void {
    event.preventDefault();
    onsave(readForm);
  }
</script>

<form onsubmit={submit} class="mt-6">
  <fieldset disabled={isBusy} class="flex min-w-0 flex-col gap-5">
    <legend class="mb-4 font-serif text-xl">
      {isPerson ? "Their birth details" : "My birth details"}
    </legend>
    {#if isPerson}
      <label class="flex flex-col gap-2">
        Name
        <input
          type="text"
          bind:value={name}
          maxlength="64"
          autocomplete="off"
          class="rounded border p-2"
        />
      </label>
    {/if}
    <BirthFields
      {idPrefix}
      timeHint="Local birth time. Omitted from the record by default."
      bind:date
      bind:time
      bind:isTimeUnknown
      bind:place
    />
    <label class="flex flex-col gap-2">
      House system
      <select bind:value={houseSystem} class="rounded border p-2">
        {#each Object.values(HouseSystem) as system (system)}
          <option value={system}>{HOUSE_SYSTEM_NAMES[system]}</option>
        {/each}
      </select>
    </label>
    <label>
      <input
        type="checkbox"
        bind:checked={shouldIncludeTime}
        disabled={isTimeUnknown}
      />
      {isPerson
        ? "Include their birth time in the saved record"
        : "Include my birth time in the saved record"}
    </label>
    <label>
      <input type="checkbox" bind:checked={hasConsented} />
      {isPerson
        ? "I have their permission to store these details in my Space"
        : "These are my own details and I want to store them in my Space"}
    </label>
    {#if note}
      <p class="text-ink-muted text-sm">{note}</p>
    {/if}
    <div class="flex flex-wrap items-center gap-4">
      <button type="submit" class="bg-accent text-paper rounded px-4 py-2">
        {isPerson ? "Save their chart" : "Save my chart"}
      </button>
      {#if oncancel}
        <button type="button" class="underline" onclick={oncancel}>
          Cancel
        </button>
      {/if}
    </div>
  </fieldset>
</form>
