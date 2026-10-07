<script setup>
import { SITE } from '../site'

defineProps({
  size: { type: Number, default: 32 },
  textClass: { type: String, default: 'text-xl font-heading font-bold tracking-tight' },
  inverse: { type: Boolean, default: false },
})
</script>

<template>
  <span class="inline-flex items-center gap-2" :class="inverse ? 'text-white' : 'text-brand-dark'">
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 64 64"
      class="shrink-0 drop-shadow-sm"
      aria-hidden="true"
    >
      <rect :width="size" height="64" rx="14" fill="#0d7a4d" />
      <path
        d="M32 10c6.5 0 11.5 1.6 15 4.7l-3 11.3L34 22l-2 20 12-14c1.6-1.8 2.8-3.9 3.5-6.3C50.6 24.6 52 28.2 52 32c0 11-9 20-20 20S12 43 12 32s9-20 20-20Z"
        fill="#f5a623"
      />
    </svg>
    <span :class="textClass">{{ SITE.name }}</span>
  </span>
</template>