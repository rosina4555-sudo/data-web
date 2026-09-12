<script setup>
import { computed } from 'vue'
import { statusMeta } from '../utils/format'

const props = defineProps({
  status: { type: String, default: '' },
  small: { type: Boolean, default: false },
})

const meta = computed(() => statusMeta(props.status))
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full font-extrabold tracking-wide whitespace-nowrap"
    :class="[meta.cls, small ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]']"
  >
    <span class="h-1.5 w-1.5 rounded-full bg-current opacity-70"></span>
    {{ meta.label }}
  </span>
</template>