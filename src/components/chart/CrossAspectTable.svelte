<!-- The aspects a moving chart makes to your natal one: transits or
     progressions. Read moving body first, as in "transiting Saturn
     squares natal Sun". Extra columns, such as when each is exact, can
     follow the orb. -->
<script lang="ts" generics="T extends Aspect">
  import type { Snippet } from "svelte";

  import { ASPECT_INFO, type Aspect } from "@/lib/astrology/aspects";
  import { BODY_INFO } from "@/lib/astrology/bodies";
  import { formatDegrees } from "@/lib/format";

  let {
    title,
    aspects,
    movingLabel,
    noneText,
    extraHeadings,
    extraCells,
  }: {
    title: string;
    /** Each aspect's first body is natal, its second is moving. */
    aspects: T[];
    /** Heads the moving body's column: "Transiting" or "Progressed". */
    movingLabel: string;
    /** Said when no aspect is within orb. */
    noneText: string;
    /** More <th>s after the orb, with extraCells giving their <td>s. */
    extraHeadings?: Snippet;
    extraCells?: Snippet<[T]>;
  } = $props();

  const columnCount = $derived(4 + (extraHeadings ? 2 : 0));
</script>

<div>
  <h3 class="ui-heading-section mb-2">{title}</h3>
  <!-- With extra columns, cells keep to one line and the table scrolls
       sideways on a narrow screen. -->
  <div class={extraHeadings ? "overflow-x-auto" : undefined}>
    <table
      class={[
        "ui-table",
        extraHeadings && "whitespace-nowrap [&_td]:pr-3 [&_th]:pr-3",
      ]}
    >
      <thead>
        <tr>
          <th scope="col">{movingLabel}</th>
          <th scope="col">Aspect</th>
          <th scope="col">Natal</th>
          <th scope="col" class="text-right">Orb</th>
          {@render extraHeadings?.()}
        </tr>
      </thead>
      <tbody>
        {#each aspects as aspect (`${aspect.first}-${aspect.second}`)}
          {@const natal = BODY_INFO[aspect.first]}
          {@const moving = BODY_INFO[aspect.second]}
          {@const info = ASPECT_INFO[aspect.type]}
          <tr>
            <td>{moving.glyph} {moving.name}</td>
            <td>{info.glyph} {info.name}</td>
            <td>{natal.glyph} {natal.name}</td>
            <td class="text-right tabular-nums">
              {formatDegrees(aspect.orbDegrees)}
            </td>
            {@render extraCells?.(aspect)}
          </tr>
        {:else}
          <tr>
            <td colspan={columnCount}>{noneText}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
