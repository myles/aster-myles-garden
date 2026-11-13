<!-- Place search combobox; follows the WAI-ARIA combobox pattern. -->
<script lang="ts">
  import { describeError } from "@/lib/format";
  import {
    formatPlace,
    loadPlaceIndex,
    searchPlaces,
    type Place,
    type PlaceIndex,
  } from "@/lib/places";

  const OPTION_ID_PREFIX = "place-option-";

  let { selected = $bindable() }: { selected?: Place } = $props();

  let index: PlaceIndex | undefined;
  let query = $state("");
  let results: Place[] = $state.raw([]);
  let activeIndex = $state(-1);
  let status = $state("");

  const isOpen = $derived(results.length > 0);
  const activeId = $derived(
    activeIndex < 0 ? undefined : `${OPTION_ID_PREFIX}${activeIndex}`,
  );

  $effect(() => {
    if (activeId) {
      document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
    }
  });

  // A place chosen from outside, e.g. by a share link, shows in the input.
  $effect(() => {
    if (selected) {
      query = formatPlace(selected);
      status = describeSelection();
    }
  });

  function describeSelection(): string {
    return selected ? `Time zone: ${selected.timeZone}` : "";
  }

  async function loadIndex(): Promise<void> {
    if (index) {
      return;
    }

    status = "Loading places…";
    try {
      index = await loadPlaceIndex();
      status = describeSelection();
      search();
    } catch (error) {
      status = `Couldn't load places: ${describeError(error)}`;
    }
  }

  function search(): void {
    if (!index) {
      return;
    }

    // Typing after choosing a place invalidates the choice.
    if (selected && query !== formatPlace(selected)) {
      selected = undefined;
      status = "";
    }

    if (selected) {
      return;
    }

    results = searchPlaces(index, query);
    activeIndex = results.length > 0 ? 0 : -1;
  }

  function choose(optionIndex: number): void {
    const place = results[optionIndex];
    if (!place) {
      return;
    }

    selected = place;
    query = formatPlace(place);
    status = describeSelection();
    close();
  }

  function close(): void {
    results = [];
    activeIndex = -1;
  }

  function onInput(event: Event & { currentTarget: HTMLInputElement }): void {
    query = event.currentTarget.value;
    search();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (!isOpen) {
      return;
    }

    const count = results.length;

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        activeIndex = (activeIndex + 1) % count;
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        activeIndex = (activeIndex - 1 + count) % count;
        break;
      }
      case "Enter": {
        // Choose the place rather than submitting the form.
        event.preventDefault();
        choose(activeIndex);
        break;
      }
      case "Escape": {
        event.preventDefault();
        close();
        break;
      }
    }
  }

  // mousedown, not click, so the input keeps focus until we're done.
  function onOptionMouseDown(event: MouseEvent, optionIndex: number): void {
    event.preventDefault();
    choose(optionIndex);
  }
</script>

<div class="relative flex flex-col gap-1.5">
  <label for="birth-place" class="text-sm font-medium">Place</label>
  <input
    id="birth-place"
    name="place"
    type="text"
    required
    autocomplete="off"
    spellcheck="false"
    placeholder="e.g. Toronto, Canada"
    role="combobox"
    aria-autocomplete="list"
    aria-expanded={String(isOpen)}
    aria-controls="place-options"
    aria-activedescendant={activeId}
    aria-describedby="place-status"
    class="border-rule bg-paper rounded border px-3 py-2"
    value={query}
    onfocus={loadIndex}
    oninput={onInput}
    onkeydown={onKeyDown}
    onblur={close}
  />
  <ul
    id="place-options"
    role="listbox"
    aria-label="Matching places"
    hidden={!isOpen}
    class="border-rule bg-panel absolute top-full z-10 mt-1 max-h-72 w-full overflow-y-auto rounded border py-1 shadow-lg"
  >
    {#each results as place, optionIndex (optionIndex)}
      <li
        id={`${OPTION_ID_PREFIX}${optionIndex}`}
        role="option"
        aria-selected={String(optionIndex === activeIndex)}
        class="aria-selected:bg-accent/15 cursor-pointer px-3 py-1.5 text-sm"
        onmousedown={(event) => onOptionMouseDown(event, optionIndex)}
      >
        {formatPlace(place)}
      </li>
    {/each}
  </ul>
  <p id="place-status" class="text-ink-muted text-xs" aria-live="polite">
    {status}
  </p>
</div>
