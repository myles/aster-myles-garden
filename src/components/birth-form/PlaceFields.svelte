<!-- A place, chosen from the list or, if it isn't listed, entered by its
     coordinates. Every id takes a prefix, so several can share a page. -->
<script lang="ts">
  import Button from "@/components/ui/Button.svelte";
  import CoordinateFields from "@/components/birth-form/CoordinateFields.svelte";
  import PlacePicker from "@/components/birth-form/PlacePicker.svelte";
  import type { Place } from "@/lib/places";

  let { idPrefix, place = $bindable() }: { idPrefix: string; place?: Place } =
    $props();

  let isEnteringCoordinates = $state(false);

  // A place set from outside, e.g. a saved chart, picks the matching mode:
  // only places entered by coordinates lack a GeoNames ID.
  $effect(() => {
    if (place) {
      isEnteringCoordinates = place.id === undefined;
    }
  });

  // Switching modes drops the place, so a stale one can't be drawn.
  function switchPlaceMode(): void {
    isEnteringCoordinates = !isEnteringCoordinates;
    place = undefined;
  }
</script>

{#if isEnteringCoordinates}
  <!-- min-w-0: a fieldset is otherwise as wide as its widest content, so
       a long time zone name would push it past the form. -->
  <fieldset class="flex min-w-0 flex-col gap-5">
    <legend class="ui-label mb-3">Place, by coordinates</legend>
    <CoordinateFields {idPrefix} bind:place />
  </fieldset>
{:else}
  <PlacePicker id={`${idPrefix}-place`} bind:selected={place} />
{/if}

<Button
  variant="quiet"
  class="-mt-3 self-start text-xs"
  onclick={switchPlaceMode}
>
  {isEnteringCoordinates
    ? "Search the list instead"
    : "Not listed? Enter coordinates"}
</Button>
