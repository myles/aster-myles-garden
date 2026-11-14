<!-- Builds a link that reopens this chart, and copies it. Nothing changes
     until the button is pressed. -->
<script lang="ts">
  import { SITE_URL } from "@/consts";
  import type { BirthDetails } from "@/lib/charts/chart";
  import { describeError } from "@/lib/format";
  import { buildShareUrl, type ShareAddition } from "@/lib/share";

  // With an addition, the link reopens the comparison or transits too.
  let {
    details,
    addition,
  }: { details: BirthDetails; addition?: ShareAddition } = $props();

  let link = $state("");
  let status = $state("");

  // A new chart makes an old link stale.
  $effect(() => {
    void details;
    void addition;
    link = "";
    status = "";
  });

  async function share(): Promise<void> {
    link = buildShareUrl(details, SITE_URL, addition);

    try {
      await navigator.clipboard.writeText(link);
      status = "Link copied.";
    } catch (cause) {
      const reason = describeError(cause);
      status = `Couldn't copy the link (${reason}). Copy it below.`;
    }
  }

  function selectAll(event: FocusEvent & { currentTarget: HTMLInputElement }) {
    event.currentTarget.select();
  }
</script>

<div>
  <h3 class="mb-3 font-serif text-lg">Share</h3>

  <div class="flex flex-wrap items-center gap-3">
    <button
      type="button"
      class="border-rule bg-panel hover:bg-accent/10 focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium focus-visible:outline-2"
      onclick={share}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        class="size-4"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M6.5 9.5a3 3 0 0 0 4.24 0l2-2a3 3 0 0 0-4.24-4.24l-.75.75M9.5 6.5a3 3 0 0 0-4.24 0l-2 2a3 3 0 0 0 4.24 4.24l.75-.75"
        />
      </svg>
      Copy link
    </button>
    <p class="text-ink-muted text-sm" aria-live="polite">{status}</p>
  </div>

  {#if link}
    <input
      type="text"
      readonly
      aria-label="Share link"
      class="border-rule bg-paper mt-3 w-full rounded border px-3 py-1.5 font-mono text-xs"
      value={link}
      onfocus={selectAll}
    />
  {/if}
</div>
