<!-- Place search combobox; follows the WAI-ARIA combobox pattern. -->
<script lang="ts">
  import Field from "@/components/ui/Field.svelte";
  import Input from "@/components/ui/Input.svelte";
  import { describeError } from "@/lib/format";
  import {
    formatPlace,
    loadPlaceIndex,
    loadTopPlaceIndex,
    searchPlaces,
    type Place,
    type PlaceIndex,
  } from "@/lib/places";

  // id is the input's; the list, status and options derive theirs from it,
  // so two pickers can share a page.
  let {
    id = "birth-place",
    selected = $bindable(),
  }: { id?: string; selected?: Place } = $props();

  const optionsId = $derived(`${id}-options`);
  const statusId = $derived(`${id}-status`);
  const optionIdPrefix = $derived(`${id}-option-`);

  // The top index stands in until the whole one arrives; only the whole
  // one is final.
  let index: PlaceIndex | undefined;
  let isIndexComplete = false;
  let isLoading = false;
  let query = $state("");
  let results: Place[] = $state.raw([]);
  let activeIndex = $state(-1);
  let status = $state("");

  const isOpen = $derived(results.length > 0);
  const activeId = $derived(
    activeIndex < 0 ? undefined : `${optionIdPrefix}${activeIndex}`,
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

  // The top index loads first, then the whole one. Loaded together, they
  // would share a slow connection, and the small one would arrive no
  // sooner than halfway. The top one's failure doesn't matter: the whole
  // index is what counts.
  async function loadIndex(): Promise<void> {
    if (isIndexComplete || isLoading) {
      return;
    }

    isLoading = true;
    status = "Loading places…";
    try {
      const top = await loadTopPlaceIndex().catch(() => undefined);
      if (top) {
        index = top;
        status = selected ? describeSelection() : "Loading smaller places…";
        search();
      }

      index = await loadPlaceIndex();
      isIndexComplete = true;
      status = describeSelection();
      search();
    } catch (error) {
      status = `Couldn't load places: ${describeError(error)}`;
    } finally {
      isLoading = false;
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

    // When the whole index replaces the top one, the place highlighted
    // stays highlighted, so Enter still chooses what was shown.
    const active = results[activeIndex];
    results = searchPlaces(index, query);
    const kept = active
      ? results.findIndex((place) => place.id === active.id)
      : -1;
    activeIndex = kept >= 0 ? kept : results.length > 0 ? 0 : -1;
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

  // Leaving the field closes the list, so coming back reopens it for
  // the text still there. The index loads on first focus.
  function onFocus(): void {
    if (index) {
      search();
    }

    void loadIndex();
  }

  function onInput(event: Event & { currentTarget: HTMLInputElement }): void {
    query = event.currentTarget.value;
    search();
  }

  function onKeyDown(event: KeyboardEvent): void {
    // Arrow Down reopens a closed list, as comboboxes do.
    if (!isOpen && event.key === "ArrowDown") {
      event.preventDefault();
      search();
      return;
    }
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

<Field {id} label="Place" class="relative">
  <Input
    {id}
    name="place"
    type="text"
    required
    autocomplete="off"
    spellcheck="false"
    placeholder="e.g. Toronto, Canada"
    role="combobox"
    aria-autocomplete="list"
    aria-expanded={String(isOpen)}
    aria-controls={optionsId}
    aria-activedescendant={activeId}
    aria-describedby={statusId}
    value={query}
    onfocus={onFocus}
    oninput={onInput}
    onkeydown={onKeyDown}
    onblur={close}
  />
  <ul
    id={optionsId}
    role="listbox"
    aria-label="Matching places"
    hidden={!isOpen}
    class="border-rule bg-panel absolute top-full z-10 mt-1 max-h-72 w-full overflow-y-auto rounded border py-1 shadow-lg"
  >
    {#each results as place, optionIndex (optionIndex)}
      <li
        id={`${optionIdPrefix}${optionIndex}`}
        role="option"
        aria-selected={String(optionIndex === activeIndex)}
        class="aria-selected:bg-accent/15 cursor-pointer px-3 py-1.5 text-sm"
        onmousedown={(event) => onOptionMouseDown(event, optionIndex)}
      >
        {formatPlace(place)}
      </li>
    {/each}
  </ul>
  <p id={statusId} class="ui-hint" aria-live="polite">
    {status}
  </p>
</Field>
