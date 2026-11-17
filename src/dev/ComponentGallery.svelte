<!-- Every UI building block in each of its states, with the colour tokens
     and type they're made from. Change a style in global.css or a
     component in ui/, and see it everywhere here at once. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  import Alert from "@/components/ui/Alert.svelte";
  import Button from "@/components/ui/Button.svelte";
  import ButtonRow from "@/components/ui/ButtonRow.svelte";
  import Callout from "@/components/ui/Callout.svelte";
  import Field from "@/components/ui/Field.svelte";
  import FormPanel from "@/components/ui/FormPanel.svelte";
  import Input from "@/components/ui/Input.svelte";
  import Select from "@/components/ui/Select.svelte";

  /** CSS custom properties from global.css, light or dark by the system. */
  const COLOURS = [
    ["--paper", "Page"],
    ["--panel", "Panels"],
    ["--ink", "Text"],
    ["--ink-muted", "Muted text"],
    ["--rule", "Rules and borders"],
    ["--accent", "Accent, and a bi-wheel's outer chart"],
    ["--challenging", "Errors, and challenging aspects"],
    ["--harmonious", "Harmonious aspects"],
    ["--fire", "Fire signs"],
    ["--earth", "Earth signs"],
    ["--air", "Air signs"],
    ["--water", "Water signs"],
  ];

  const VARIANTS = ["primary", "secondary", "action", "tool", "quiet"] as const;

  let text = $state("Typed text");
  let date = $state("2000-01-01");
  let choice = $state("placidus");
  let isPressed = $state(false);
  let submitted = $state(0);
</script>

{#snippet section(title: string, intro: string, body: Snippet)}
  <section class="border-rule border-t py-8">
    <h2 class="ui-heading-view">{title}</h2>
    <p class="text-ink-muted mt-1 mb-6 text-sm">{intro}</p>
    {@render body()}
  </section>
{/snippet}

{#snippet specimen(label: string, body: Snippet)}
  <div class="flex flex-col gap-2">
    <p class="ui-hint font-mono">{label}</p>
    <div>{@render body()}</div>
  </div>
{/snippet}

<header class="mb-6">
  <h1 class="font-serif text-4xl tracking-tight">Components</h1>
  <p class="text-ink-muted mt-1">
    The page's building blocks, from <code>src/styles/global.css</code> and
    <code>src/components/ui/</code>. Only <code>npm run dev</code> serves this page.
    To see dark mode, switch the system theme or emulate it in the browser's developer
    tools.
  </p>
</header>

{#snippet colours()}
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each COLOURS as [token, use] (token)}
      <div class="flex items-center gap-3">
        <span
          class="border-rule size-10 shrink-0 rounded border"
          style:background={`var(${token})`}
        ></span>
        <span class="text-sm">
          <code>{token}</code><br />
          <span class="text-ink-muted">{use}</span>
        </span>
      </div>
    {/each}
  </div>
{/snippet}
{@render section("Colours", "Tokens, set for light and dark.", colours)}

{#snippet type()}
  <div class="flex flex-col gap-4">
    {#snippet viewHeading()}
      <p class="ui-heading-view">London, England, United Kingdom</p>
    {/snippet}
    {@render specimen(".ui-heading-view", viewHeading)}
    {#snippet sectionHeading()}
      <p class="ui-heading-section">Positions</p>
    {/snippet}
    {@render specimen(".ui-heading-section", sectionHeading)}
    {#snippet label()}<p class="ui-label">House system</p>{/snippet}
    {@render specimen(".ui-label", label)}
    {#snippet hint()}<p class="ui-hint">
        Local clock time where you were born.
      </p>{/snippet}
    {@render specimen(".ui-hint", hint)}
  </div>
{/snippet}
{@render section("Type", "Headings, labels and hints.", type)}

{#snippet buttons()}
  <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
    {#each VARIANTS as variant (variant)}
      {#snippet normal()}
        <ButtonRow>
          <Button {variant}>Show transits</Button>
          <Button {variant} disabled>Disabled</Button>
        </ButtonRow>
      {/snippet}
      {@render specimen(`<Button variant="${variant}">`, normal)}
    {/each}
    {#snippet small()}
      <ButtonRow>
        <Button size="small">Use</Button>
        <Button size="small" disabled>Save</Button>
      </ButtonRow>
    {/snippet}
    {@render specimen('<Button size="small">', small)}
    {#snippet pressed()}
      <Button
        variant="tool"
        aria-pressed={String(isPressed)}
        class="aria-pressed:bg-accent/15"
        onclick={() => (isPressed = !isPressed)}
      >
        Enlarge wheel
      </Button>
    {/snippet}
    {@render specimen('<Button variant="tool" aria-pressed>', pressed)}
  </div>
{/snippet}
{@render section(
  "Buttons",
  "Each variant, enabled and disabled. Secondary is the default.",
  buttons,
)}

{#snippet fields()}
  <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
    {#snippet textField()}
      <Field id="gallery-text" label="Name" hint="A hint under the control.">
        <Input id="gallery-text" type="text" bind:value={text} />
      </Field>
    {/snippet}
    {@render specimen("<Field hint> + <Input>", textField)}
    {#snippet optionalField()}
      <Field id="gallery-optional" label="Name" optional>
        <Input
          id="gallery-optional"
          type="text"
          placeholder="e.g. Smallville"
        />
      </Field>
    {/snippet}
    {@render specimen("<Field optional>", optionalField)}
    {#snippet dateField()}
      <Field id="gallery-date" label="Date">
        <Input id="gallery-date" type="date" bind:value={date} />
      </Field>
    {/snippet}
    {@render specimen('<Input type="date">', dateField)}
    {#snippet selectField()}
      <Field id="gallery-select" label="House system">
        <Select id="gallery-select" bind:value={choice}>
          <option value="placidus">Placidus</option>
          <option value="koch">Koch</option>
          <option value="wholeSign">Whole sign</option>
        </Select>
      </Field>
    {/snippet}
    {@render specimen("<Select>", selectField)}
    {#snippet disabledField()}
      <Field id="gallery-disabled" label="Time">
        <Input id="gallery-disabled" type="time" disabled />
        <p class="ui-hint">The chart is cast for noon, without houses.</p>
      </Field>
    {/snippet}
    {@render specimen("<Input disabled>", disabledField)}
    {#snippet errorField()}
      <Field id="gallery-error" label="Coordinates">
        <Input
          id="gallery-error"
          type="text"
          value="91, 200"
          aria-invalid="true"
        />
        <p class="ui-hint">
          <span class="text-challenging">Latitude must be from -90 to 90.</span>
        </p>
      </Field>
    {/snippet}
    {@render specimen("A field's own error", errorField)}
    {#snippet smallInput()}
      <div class="flex gap-2">
        <Input size="small" class="min-w-0 flex-1" placeholder="e.g. Me" />
        <Button size="small">Save</Button>
      </div>
    {/snippet}
    {@render specimen('<Input size="small">', smallInput)}
  </div>
{/snippet}
{@render section("Fields", "Labels, controls and hints.", fields)}

{#snippet messages()}
  <div class="grid gap-6 sm:grid-cols-2">
    {#snippet alert()}
      <Alert message="Enter both a date and a time." />
    {/snippet}
    {@render specimen("<Alert message>", alert)}
    {#snippet callout()}
      <Callout>
        Placidus houses can't be cast this close to the pole, so the chart uses
        Porphyry.
      </Callout>
    {/snippet}
    {@render specimen("<Callout>", callout)}
  </div>
{/snippet}
{@render section(
  "Messages",
  "An Alert stays in the page, hidden, while it's empty, so its first message is read out.",
  messages,
)}

{#snippet panels()}
  <div class="grid gap-6 lg:grid-cols-2">
    {#snippet panel()}
      <FormPanel
        title="Transit moment"
        onsubmit={(event) => {
          event.preventDefault();
          submitted++;
        }}
      >
        {#snippet description()}A line under the title.{/snippet}
        <Field id="gallery-panel-date" label="Date">
          <Input id="gallery-panel-date" type="date" bind:value={date} />
        </Field>
        <ButtonRow>
          <Button variant="primary" type="submit">Show transits</Button>
          <Button>Back to your chart</Button>
        </ButtonRow>
        <Alert
          message={submitted > 0
            ? `Submitted ${submitted} time${submitted === 1 ? "" : "s"}.`
            : ""}
        />
      </FormPanel>
    {/snippet}
    {@render specimen("<FormPanel> + <ButtonRow> + <Alert>", panel)}
    {#snippet menu()}
      <div class="flex flex-col gap-2">
        <Button variant="action">Compare with someone else</Button>
        <Button variant="action">See transits</Button>
      </div>
    {/snippet}
    {@render specimen('A menu of <Button variant="action">', menu)}
  </div>
{/snippet}
{@render section("Panels", "Forms in a bordered panel.", panels)}

{#snippet tables()}
  {#snippet table()}
    <table class="ui-table">
      <thead>
        <tr>
          <th scope="col">Body</th>
          <th scope="col">Position</th>
          <th scope="col" class="text-right">House</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>☉︎ Sun</td>
          <td>10° 00′ Capricorn</td>
          <td class="text-right tabular-nums">10</td>
        </tr>
        <tr>
          <td>☽︎ Moon</td>
          <td>12° 34′ Scorpio ℞</td>
          <td class="text-right tabular-nums">8</td>
        </tr>
      </tbody>
    </table>
  {/snippet}
  {@render specimen(".ui-table", table)}
{/snippet}
{@render section(
  "Tables",
  "Rows of figures. A cell's own classes, such as text-right, win over the table's.",
  tables,
)}
