<!-- One chart's aspects: each pair of planets, the aspect, and its orb. -->
<script lang="ts">
  import {
    ASPECT_INFO,
    type Aspect,
    type AspectSettings,
  } from "@/lib/astrology/aspects";
  import { BODY_INFO } from "@/lib/astrology/bodies";
  import { formatDegrees, formatNoAspects } from "@/lib/format";

  let {
    aspects,
    settings,
    title = "Aspects",
    firstLabel = "",
    secondLabel = "",
  }: {
    aspects: Aspect[];
    settings: AspectSettings | undefined;
    title?: string;
    firstLabel?: string;
    secondLabel?: string;
  } = $props();
</script>

<div>
  <h3 class="ui-heading-section mb-2">{title}</h3>
  <table class="ui-table">
    <thead>
      <tr>
        <th scope="col">Pair</th>
        <th scope="col">Aspect</th>
        <th scope="col" class="text-right">Orb</th>
      </tr>
    </thead>
    <tbody>
      {#each aspects as aspect (`${aspect.first}-${aspect.second}`)}
        {@const first = BODY_INFO[aspect.first]}
        {@const second = BODY_INFO[aspect.second]}
        {@const info = ASPECT_INFO[aspect.type]}
        <tr>
          <td>
            {first.glyph}
            {firstLabel}
            {first.name} – {second.glyph}
            {secondLabel}
            {second.name}
          </td>
          <td>{info.glyph} {info.name}</td>
          <td class="text-right tabular-nums">
            {formatDegrees(aspect.orbDegrees)}
          </td>
        </tr>
      {:else}
        <tr>
          <td colspan="3">
            {formatNoAspects(settings)} within orb.
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
