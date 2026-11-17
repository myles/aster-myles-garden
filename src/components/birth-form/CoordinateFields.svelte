<!-- A place that isn't in the index, entered by its coordinates. The time
     zone is suggested from the nearest listed place until someone picks
     one themselves. -->
<script lang="ts">
  import Field from "@/components/ui/Field.svelte";
  import Input from "@/components/ui/Input.svelte";
  import Select from "@/components/ui/Select.svelte";
  import { describeError, formatCoordinates } from "@/lib/format";
  import {
    createCoordinatePlace,
    findNearestPlace,
    formatPlace,
    loadPlaceIndex,
    parseCoordinates,
    type Place,
    type PlaceIndex,
  } from "@/lib/places";
  import { getLocalTimeZone, listTimeZones } from "@/lib/time";
  import { onMount } from "svelte";

  let { idPrefix, place = $bindable() }: { idPrefix: string; place?: Place } =
    $props();

  const baseTimeZones = listTimeZones();

  let coordinates = $state("");
  let timeZone = $state(getLocalTimeZone());
  let name = $state("");
  let isTimeZoneChosen = $state(false);
  let coordinatesError = $state("");
  let indexError = $state("");
  let nearest: { place: Place; distanceKm: number } | undefined = $state.raw();
  let index: PlaceIndex | undefined;
  // The last place this component built, to tell it from one set outside.
  // Compared by value: a parent's $state wraps it in a proxy, so the place
  // that comes back is never the same object.
  let builtPlace: Place | undefined;

  // The browser's list uses some old spellings, so make sure the current
  // zone is an option even when it isn't listed.
  const timeZones = $derived(
    baseTimeZones.includes(timeZone)
      ? baseTimeZones
      : [...baseTimeZones, timeZone].toSorted(),
  );

  // A place set from outside, e.g. a saved chart, fills in the fields.
  $effect(() => {
    if (!place || place.id !== undefined || isSamePlace(place, builtPlace)) {
      return;
    }

    const { latitude, longitude } = place;
    coordinates = `${latitude}, ${longitude}`;
    timeZone = place.timeZone;
    name =
      place.name === formatCoordinates(latitude, longitude) ? "" : place.name;
    isTimeZoneChosen = true;
    builtPlace = place;
    findNearest(latitude, longitude);
  });

  onMount(() => {
    void loadIndex();
  });

  // Only needed to suggest a time zone, so a failure isn't fatal.
  async function loadIndex(): Promise<void> {
    try {
      index = await loadPlaceIndex();
      update();
    } catch (cause) {
      indexError =
        `Couldn't load places to suggest a time zone ` +
        `(${describeError(cause)}). Choose one yourself.`;
    }
  }

  function isSamePlace(a: Place, b: Place | undefined): boolean {
    return (
      b !== undefined &&
      a.latitude === b.latitude &&
      a.longitude === b.longitude &&
      a.timeZone === b.timeZone &&
      a.name === b.name
    );
  }

  function findNearest(latitude: number, longitude: number): void {
    nearest = index ? findNearestPlace(index, latitude, longitude) : undefined;
  }

  /** Rebuilds the place from the fields, or clears it if they're invalid. */
  function update(): void {
    let parsed: { latitude: number; longitude: number };

    try {
      parsed = parseCoordinates(coordinates);
      coordinatesError = "";
    } catch (cause) {
      // Say nothing until something's been typed.
      coordinatesError = coordinates.trim() ? describeError(cause) : "";
      nearest = undefined;
      builtPlace = undefined;
      place = undefined;
      return;
    }

    findNearest(parsed.latitude, parsed.longitude);
    if (nearest && !isTimeZoneChosen) {
      timeZone = nearest.place.timeZone;
    }

    builtPlace = createCoordinatePlace({ ...parsed, name, timeZone });
    place = builtPlace;
  }

  function onTimeZoneChange(): void {
    isTimeZoneChosen = true;
    update();
  }
</script>

<Field id={`${idPrefix}-coordinates`} label="Coordinates">
  <Input
    id={`${idPrefix}-coordinates`}
    name="coordinates"
    type="text"
    inputmode="decimal"
    autocomplete="off"
    spellcheck="false"
    placeholder="e.g. 43.7064, -79.3986"
    aria-describedby={`${idPrefix}-coordinates-hint`}
    aria-invalid={coordinatesError ? "true" : undefined}
    bind:value={coordinates}
    oninput={update}
  />
  <p id={`${idPrefix}-coordinates-hint`} class="ui-hint">
    {#if coordinatesError}
      <span class="text-challenging">{coordinatesError}</span>
    {:else}
      Latitude, longitude in decimal degrees, as maps copy them. South and west
      are negative.
    {/if}
  </p>
</Field>

<Field id={`${idPrefix}-time-zone`} label="Time zone">
  <Select
    id={`${idPrefix}-time-zone`}
    name="timeZone"
    aria-describedby={`${idPrefix}-time-zone-hint`}
    bind:value={timeZone}
    onchange={onTimeZoneChange}
  >
    {#each timeZones as zone (zone)}
      <option value={zone}>{zone}</option>
    {/each}
  </Select>
  <p id={`${idPrefix}-time-zone-hint`} class="ui-hint">
    {#if indexError}
      {indexError}
    {:else if nearest}
      {isTimeZoneChosen ? "Nearest" : "Suggested from the nearest"} listed place:
      {formatPlace(nearest.place)}, {Math.round(nearest.distanceKm)} km away.
    {:else}
      Suggested once the coordinates are in.
    {/if}
  </p>
</Field>

<Field id={`${idPrefix}-place-name`} label="Name" optional>
  <Input
    id={`${idPrefix}-place-name`}
    name="placeName"
    type="text"
    autocomplete="off"
    placeholder="e.g. Smallville"
    bind:value={name}
    oninput={update}
  />
</Field>
