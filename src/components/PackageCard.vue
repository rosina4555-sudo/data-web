<script setup>
import { computed } from 'vue'
import { currency } from '../utils/format'
import { NETWORK_BTN, NETWORK_COLORS, SITE } from '../site'

const props = defineProps({
  network: { type: Object, default: () => ({ code: 'MTN', name: 'MTN' }) },
  pkg: { type: Object, required: true },
  featured: { type: Boolean, default: false },
})

const emit = defineEmits(['buy'])

const sizeLabel = computed(() => props.pkg.provider_package?.size_label || props.pkg.size_label || '')
const gradient = computed(() => NETWORK_COLORS[props.network.code] || NETWORK_COLORS.DEFAULT)
const buyBtn = computed(() => NETWORK_BTN[props.network.code] || NETWORK_BTN.DEFAULT)
const priceRaw = computed(() => Number(props.pkg.sell_price || 0))

const perks = computed(() => {
  const list = []
  if (sizeLabel.value) list.push(sizeLabel.value)
  list.push('Instant top-up')
  list.push(`For ${props.network.code}`)
  return list
})
</script>

<template>
  <article
    class="clay group mx-auto flex max-w-md flex-col overflow-hidden rounded-3xl border border-brand/10 bg-surface text-ink transition-transform duration-300 hover:-translate-y-1 md:mx-0 md:max-w-none"
    :class="featured ? 'ring-2 ring-accent/40' : ''"
  >
    <!-- Gradient cap -->
    <div class="relative px-4 pt-4">
      <div
        class="relative flex h-24 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br sm:h-28"
        :class="gradient"
      >
        <div class="pointer-events-none absolute inset-x-3 top-1.5 h-6 rounded-full bg-white/25 blur-md"></div>
        <div class="flex items-center gap-3 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
          <!-- Signal bars -->
          <svg class="h-9 w-9 sm:h-10 sm:w-10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="2.5" y="15" width="4" height="5.5" rx="1" />
            <rect x="8.5" y="11" width="4" height="9.5" rx="1" />
            <rect x="14.5" y="7" width="4" height="13.5" rx="1" />
            <rect x="20.5" y="3" width="1.5" height="17.5" rx="0.75" opacity="0.75" />
          </svg>
          <div class="text-left">
            <p class="font-heading text-2xl font-black leading-none sm:text-3xl">{{ pkg.name }}</p>
            <p class="mt-1 text-xs font-bold tracking-widest opacity-90 uppercase">{{ SITE.networksServed }}</p>
          </div>
        </div>
      </div>
      <span
        v-if="featured"
        class="clay-sm absolute top-5 right-5 rounded-full bg-surface px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-accent-dark uppercase"
      >
        Best value
      </span>
    </div>

    <!-- Body -->
    <div class="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
      <ul class="mt-0.5 space-y-1.5">
        <li
          v-for="(perk, i) in perks"
          :key="i"
          class="flex items-center gap-2 text-xs font-medium text-muted"
        >
          <svg class="h-3.5 w-3.5 shrink-0 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          {{ perk }}
        </li>
      </ul>

      <div class="mt-3 flex items-end justify-between gap-3">
        <div>
          <p class="text-[10px] font-bold tracking-widest text-muted uppercase">Price</p>
          <p class="font-heading text-2xl font-black tracking-tight text-brand sm:text-3xl">
            {{ currency(priceRaw) }}
          </p>
        </div>
        <span
          v-if="NETWORK_COLORS[network.code]"
          class="rounded-full bg-gradient-to-r px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase"
          :class="NETWORK_COLORS[network.code]"
        >
          {{ network.code }}
        </span>
      </div>

      <button
        type="button"
        @click="emit('buy', pkg)"
        class="clay-btn-buy mt-4 w-full shrink-0 rounded-2xl bg-gradient-to-r py-2.5 text-sm font-extrabold tracking-wide text-white focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none sm:py-3"
        :class="buyBtn.grad"
        :style="{ '--buy-glow': buyBtn.glow }"
      >
        Buy Data Bundle →
      </button>
    </div>
  </article>
</template>