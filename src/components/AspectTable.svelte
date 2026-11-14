<!-- One chart's aspects: each pair of planets, the aspect, and its orb. -->
<script lang="ts">
  import { ASPECT_INFO, type Aspect, type AspectSettings } from "@/lib/aspects";
  import { BODY_INFO } from "@/lib/bodies";
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
  <h3 class="mb-2 font-serif text-lg">{title}</h3>
  <table class="w-full text-sm">
    <thead class="text-ink-muted text-left">
      <tr class="border-rule border-b">
        <th scope="col" class="py-1.5 font-normal">Pair</th>
        <th scope="col" class="py-1.5 font-normal">Aspect</th>
        <th scope="col" class="py-1.5 text-right font-normal">Orb</th>
      </tr>
    </thead>
    <tbody>
      {#each aspects as aspect (`${aspect.first}-${aspect.second}`)}
        {@const first = BODY_INFO[aspect.first]}
        {@const second = BODY_INFO[aspect.second]}
        {@const info = ASPECT_INFO[aspect.type]}
        <tr class="border-rule/60 border-b">
          <td class="py-1.5">
            {first.glyph}
            {firstLabel}
            {first.name} – {second.glyph}
            {secondLabel}
            {second.name}
          </td>
          <td class="py-1.5">{info.glyph} {info.name}</td>
          <td class="py-1.5 text-right tabular-nums">
            {formatDegrees(aspect.orbDegrees)}
          </td>
        </tr>
      {:else}
        <tr class="border-rule/60 border-b">
          <td class="py-1.5" colspan="3">
            {formatNoAspects(settings)} within orb.
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
