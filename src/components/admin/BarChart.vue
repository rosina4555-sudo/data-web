<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: Array, required: true }, // [{label, value}]
  height: { type: String, default: '14rem' },
  barColor: { type: String, default: 'from-brand to-accent' },
  currency: { type: Boolean, default: false },
  money: { type: Boolean, default: false }, // values are 2-dp money strings (GHS)
})

const max = computed(() => Math.max(...props.data.map((d) => Number(d.value) || 0), 1))

const fmt = (v) => {
  const n = Number(v)
  if (props.money) return `₵${n.toLocaleString('en-GH', { maximumFractionDigits: n >= 1000 ? 0 : 1 })}`
  return n.toLocaleString('en-GH', { maximumFractionDigits: 0 })
}

const yLabels = computed(() => {
  const m = max.value
  return [m, m * 0.75, m * 0.5, m * 0.25, 0].map(fmt)
})

const barStyle = (d) => {
  const pct = max.value > 0 ? (Number(d.value) / max.value) * 100 : 0
  return { height: `${pct}%`, minHeight: pct > 0 ? '4px' : '0' }
}

const showLabel = (i) => props.data.length <= 7 || i % 2 === 0

const barPosition = (i) => {
  const count = props.data.length
  const gap = 4
  const totalGaps = (count - 1) * gap
  const width = `calc((100% - ${totalGaps}px) / ${count})`
  const left = `calc(${i} * (100% - ${totalGaps}px) / ${count} + ${i * gap}px)`
  return { width, left }
}
</script>

<template>
  <div class="w-full">
    <div class="flex gap-2" :style="{ height }">
      <div class="flex flex-col justify-between py-0.5 text-right" style="width: 3.4rem">
        <span v-for="(label, i) in yLabels" :key="i" class="text-[10px] font-medium leading-none text-muted/50">{{ label }}</span>
      </div>
      <div class="relative flex-1 border-b border-l border-brand/10">
        <div class="pointer-events-none absolute inset-0 flex flex-col justify-between">
          <div v-for="i in 4" :key="i" class="w-full border-t border-brand/5"></div>
        </div>
        <div class="absolute inset-0 px-1">
          <div v-for="(d, i) in data" :key="i" class="group absolute bottom-0" :style="{ ...barPosition(i), height: '100%' }">
            <div class="absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap group-hover:block">
              <div class="rounded-lg bg-brand-dark px-2 py-1 text-[10px] font-bold text-white shadow-lg">{{ fmt(d.value) }}</div>
            </div>
            <div class="absolute right-0 bottom-0 left-0 rounded-t-sm bg-gradient-to-t transition-all duration-300 group-hover:opacity-80" :class="barColor" :style="barStyle(d)"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="ml-[3.4rem] mt-1.5 px-1" style="position: relative">
      <div class="flex" style="position: relative; height: 1.2rem">
        <span
          v-for="(d, i) in data"
          :key="i"
          class="absolute truncate text-center text-[9px] font-medium text-muted/50 sm:text-[10px]"
          :style="{ ...barPosition(i), top: 0 }"
        >
          {{ showLabel(i) ? d.label : '' }}
        </span>
      </div>
    </div>
  </div>
</template>