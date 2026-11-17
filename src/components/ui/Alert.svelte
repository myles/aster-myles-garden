<!-- An error, read out by screen readers as soon as it appears. It stays
     in the page while empty, so the first message is announced too. -->
<script lang="ts">
  let { message, class: className = "" }: { message: string; class?: string } =
    $props();
</script>

<p role="alert" class="ui-alert {className}" hidden={message.length === 0}>
  {message}
</p>
