<!-- The chart settings under your birth details: house system, zodiac,
     and which aspects to find, with how wide their orbs are. -->
<script lang="ts">
  import { TROPICAL } from "@/components/panels/zodiac";
  import Field from "@/components/ui/Field.svelte";
  import Select from "@/components/ui/Select.svelte";
  import {
    ASPECT_SET_NAMES,
    AspectSet,
    ORB_SIZE_NAMES,
    OrbSize,
  } from "@/lib/astrology/aspects";
  import { AYANAMSA_NAMES, Ayanamsa } from "@/lib/astrology/ayanamsa";
  import { HOUSE_SYSTEM_NAMES, HouseSystem } from "@/lib/astrology/houses";

  let {
    houseSystem = $bindable(),
    zodiac = $bindable(),
    aspectSet = $bindable(),
    orbSize = $bindable(),
    isHouseSystemUnused,
    note,
    onchange,
  }: {
    houseSystem: string;
    /** TROPICAL, or the ayanamsa of a sidereal zodiac. */
    zodiac: string;
    aspectSet: AspectSet;
    orbSize: OrbSize;
    /** No chart on screen could have houses: there's no birth time. */
    isHouseSystemUnused: boolean;
    /** Why settings can't be remembered, when they can't. */
    note: string;
    onchange: () => void;
  } = $props();

  const houseSystems = Object.values(HouseSystem);
  const ayanamsas = Object.values(Ayanamsa);
  const aspectSets = Object.values(AspectSet);
  const orbSizes = Object.values(OrbSize);
</script>

<Field id="house-system" label="House system">
  <Select
    id="house-system"
    name="houseSystem"
    bind:value={houseSystem}
    disabled={isHouseSystemUnused}
    {onchange}
  >
    {#each houseSystems as system (system)}
      <option value={system}>{HOUSE_SYSTEM_NAMES[system]}</option>
    {/each}
  </Select>
  {#if isHouseSystemUnused}
    <p class="ui-hint">Houses need a birth time.</p>
  {/if}
</Field>

<Field id="zodiac" label="Zodiac">
  <Select id="zodiac" name="zodiac" bind:value={zodiac} {onchange}>
    <option value={TROPICAL}>Tropical</option>
    <optgroup label="Sidereal">
      {#each ayanamsas as option (option)}
        <option value={option}>
          Sidereal, {AYANAMSA_NAMES[option]}
        </option>
      {/each}
    </optgroup>
  </Select>
</Field>

<div class="grid grid-cols-2 gap-3">
  <Field id="aspect-set" label="Aspects">
    <Select id="aspect-set" name="aspectSet" bind:value={aspectSet} {onchange}>
      {#each aspectSets as set (set)}
        <option value={set}>{ASPECT_SET_NAMES[set]}</option>
      {/each}
    </Select>
  </Field>

  <Field id="orb-size" label="Orbs">
    <Select id="orb-size" name="orbSize" bind:value={orbSize} {onchange}>
      {#each orbSizes as size (size)}
        <option value={size}>{ORB_SIZE_NAMES[size]}</option>
      {/each}
    </Select>
  </Field>
</div>
{#if note}
  <p class="text-ink-muted -mt-3 text-xs">{note}</p>
{/if}
