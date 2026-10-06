<script setup>
/**
 * A panel whose load failed, plus the button that runs it again.
 *
 * Every partner panel used to print the message and stop there, so one dropped
 * request left a permanently blank screen whose only cure was a full page
 * reload. Retry re-runs the panel's own load function — same filters, same page
 * — because that is what the operator was reaching for when they clicked.
 *
 * `busy` disables the button while the retry is in flight so a double click
 * cannot fire two parallel loads racing over the same refs.
 */
defineProps({
  error: { type: String, default: '' },
  busy: { type: Boolean, default: false },
})

defineEmits(['retry'])
</script>

<template>
  <div
    v-if="error"
    class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3"
    role="alert"
  >
    <p class="text-xs font-semibold text-red-600">{{ error }}</p>
    <button
      type="button"
      class="shrink-0 rounded-lg bg-surface px-3 py-1.5 text-[11px] font-extrabold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
      :disabled="busy"
      @click="$emit('retry')"
    >
      {{ busy ? 'Retrying…' : 'Try again' }}
    </button>
  </div>
</template>
