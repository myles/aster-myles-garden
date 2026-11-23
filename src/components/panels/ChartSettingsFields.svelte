<!-- The chart settings under your birth details: house system, zodiac,
     and which aspects to find, with how wide their orbs are. -->
<script lang="ts">
  import HelpPanel from "@/components/guide/HelpPanel.svelte";
  import HelpToggle from "@/components/guide/HelpToggle.svelte";
  import { GuideTopic } from "@/components/guide/topics";
  import { toAyanamsa, TROPICAL } from "@/components/panels/zodiac";
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

  const ASPECT_SET_SUMMARIES: Record<AspectSet, string> = {
    [AspectSet.Major]: "Major aspects",
    [AspectSet.All]: "Major and minor aspects",
  };

  // One line under the heading, so the settings show while collapsed:
  // "Placidus · Tropical · Major aspects · Standard orbs".
  const summary = $derived.by(() => {
    const ayanamsa = toAyanamsa(zodiac);
    const parts = [
      ayanamsa ? `Sidereal (${AYANAMSA_NAMES[ayanamsa]})` : "Tropical",
      ASPECT_SET_SUMMARIES[aspectSet],
      `${ORB_SIZE_NAMES[orbSize]} orbs`,
    ];
    if (!isHouseSystemUnused) {
      parts.unshift(HOUSE_SYSTEM_NAMES[houseSystem as HouseSystem]);
    }

    return parts.join(" · ");
  });

  // A grid cell is too narrow for a topic's explanation, so each row's
  // opens across both columns beneath it, one topic at a time.
  const HELP_ROWS = [
    [GuideTopic.HouseSystem, GuideTopic.Zodiac],
    [GuideTopic.Aspects, GuideTopic.Orbs],
  ];
  const helpIdPrefix = $props.id();
  let openTopic: GuideTopic | undefined = $state();

  function findHelpRow(topic: GuideTopic): number {
    return HELP_ROWS.findIndex((row) => row.includes(topic));
  }
</script>

{#snippet settingHelp(topic: GuideTopic)}
  <HelpToggle
    {topic}
    panelId={`${helpIdPrefix}-${findHelpRow(topic)}`}
    bind:isOpen={
      () => openTopic === topic,
      (isOpen) => (openTopic = isOpen ? topic : undefined)
    }
  />
{/snippet}

{#snippet rowHelp(rowIndex: number)}
  <HelpPanel
    id={`${helpIdPrefix}-${rowIndex}`}
    topic={HELP_ROWS[rowIndex].find((topic) => topic === openTopic)}
    class="col-span-2 -mt-2"
  />
{/snippet}

<!-- Collapsed so the Draw chart button shows on first load; the
     defaults suit most people. -->
<details class="group border-rule border-t pt-4">
  <summary
    class="flex cursor-pointer list-none flex-col gap-1 [&::-webkit-details-marker]:hidden"
  >
    <span class="text-sm font-medium">
      Chart settings
      <span
        aria-hidden="true"
        class="text-ink-muted inline-block group-open:rotate-90">▸</span
      >
    </span>
    <span data-settings-summary class="text-ink-muted font-mono text-xs">
      {summary}
    </span>
  </summary>
  <div class="grid grid-cols-2 gap-4 pt-4">
    <Field id="house-system" label="House system">
      {#snippet help()}{@render settingHelp(GuideTopic.HouseSystem)}{/snippet}
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
      {#snippet help()}{@render settingHelp(GuideTopic.Zodiac)}{/snippet}
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
    {@render rowHelp(0)}

    <Field id="aspect-set" label="Aspects">
      {#snippet help()}{@render settingHelp(GuideTopic.Aspects)}{/snippet}
      <Select
        id="aspect-set"
        name="aspectSet"
        bind:value={aspectSet}
        {onchange}
      >
        {#each aspectSets as set (set)}
          <option value={set}>{ASPECT_SET_NAMES[set]}</option>
        {/each}
      </Select>
    </Field>

    <Field id="orb-size" label="Orbs">
      {#snippet help()}{@render settingHelp(GuideTopic.Orbs)}{/snippet}
      <Select id="orb-size" name="orbSize" bind:value={orbSize} {onchange}>
        {#each orbSizes as size (size)}
          <option value={size}>{ORB_SIZE_NAMES[size]}</option>
        {/each}
      </Select>
    </Field>
    {@render rowHelp(1)}
  </div>
</details>
{#if note}
  <p class="text-ink-muted -mt-3 text-xs">{note}</p>
{/if}
