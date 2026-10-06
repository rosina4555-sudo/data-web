<script setup>
import { toasts, dismiss } from '../services/toast'

// A warning is not a success and must not wear its tick: bulk refunds report
// partial failures as 'warning', and the old markup gave anything that was
// not an error a tick badge, so "3 of 5 failed" arrived looking like a pass.
const TONE = {
  success: { text: 'text-brand', badge: 'bg-brand', glyph: '✓' },
  error: { text: 'text-red-600', badge: 'bg-red-500', glyph: '!' },
  warning: { text: 'text-amber-700', badge: 'bg-amber-500', glyph: '!' },
  info: { text: 'text-brand-dark', badge: 'bg-muted', glyph: 'i' },
}

const tone = (type) => TONE[type] || TONE.info
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="clay-sm pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-2xl border border-brand/10 bg-surface px-3.5 py-3 text-sm font-semibold shadow-lg"
          :class="tone(t.type).text"
        >
          <span
            class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
            :class="tone(t.type).badge"
          >
            {{ tone(t.type).glyph }}
          </span>
          <p class="flex-1 leading-snug">{{ t.message }}</p>
          <button
            type="button"
            aria-label="Dismiss"
            class="text-muted/50 transition hover:text-muted"
            @click="dismiss(t.id)"
          >
            ✕
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}
</style>