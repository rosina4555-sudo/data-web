<script setup>
/**
 * Bundle grid.
 *
 * On phones the bundles are one-ish-card-wide swipe carousel with dots; from
 * small tablets up they collapse into the normal grid. Both the marketplace
 * and a shop use this, so a bundle looks and behaves the same wherever it is
 * sold.
 */
import { ref, computed, watch } from 'vue'
import PackageCard from './PackageCard.vue'

const props = defineProps({
  packages: { type: Array, default: () => [] },
  network: { type: Object, default: () => ({ code: 'MTN', name: 'MTN' }) },
})

const emit = defineEmits(['buy'])

const carouselEl = ref(null)
const activeDot = ref(0)

// The biggest bundle in the row is the one worth pointing at.
const featuredIndex = computed(() => {
  let best = 0
  let bestSize = -1
  props.packages.forEach((pkg, i) => {
    const m = (pkg.name || '').match(/(\d+(?:\.\d+)?)\s*[GMK]B/i)
    const size = m
      ? parseFloat(m[1]) * (m[0].toUpperCase().includes('G') ? 1024 : m[0].toUpperCase().includes('M') ? 1 : 1 / 1024)
      : 0
    if (size > bestSize) {
      bestSize = size
      best = i
    }
  })
  return best
})

watch(
  () => props.packages,
  () => {
    activeDot.value = 0
    carouselEl.value?.scrollTo({ left: 0 })
  },
)

const onCarouselScroll = () => {
  const el = carouselEl.value
  if (!el || !el.children.length) return
  const children = [...el.children]
  const center = el.scrollLeft + el.clientWidth / 2
  let nearest = 0
  let minDist = Infinity
  children.forEach((child, i) => {
    const childCenter = child.offsetLeft + child.offsetWidth / 2
    const dist = Math.abs(childCenter - center)
    if (dist < minDist) {
      minDist = dist
      nearest = i
    }
  })
  activeDot.value = nearest
}

const goToSlide = (i) => {
  const el = carouselEl.value
  if (!el || !el.children[i]) return
  el.scrollTo({
    left: el.children[i].offsetLeft - (el.clientWidth - el.children[i].offsetWidth) / 2,
    behavior: 'smooth',
  })
}
</script>

<template>
  <div
    ref="carouselEl"
    class="hide-scrollbar -mx-4 flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto scroll-p-6 px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 lg:grid-cols-3 lg:gap-6"
    @scroll.passive="onCarouselScroll"
  >
    <div
      v-for="(pkg, i) in packages"
      :key="pkg.id"
      class="w-[84vw] max-w-[21rem] shrink-0 snap-center last:snap-end sm:w-full sm:max-w-none sm:shrink"
    >
      <PackageCard
        :network="network"
        :pkg="pkg"
        :featured="i === featuredIndex && packages.length > 1"
        @buy="emit('buy', pkg)"
      />
    </div>
  </div>

  <!-- Dot indicators (mobile) -->
  <div v-if="packages.length > 1" class="mt-3 flex shrink-0 items-center justify-center gap-2 sm:hidden">
    <button
      v-for="(_, i) in packages"
      :key="i"
      type="button"
      :aria-label="`Go to bundle ${i + 1}`"
      class="h-2 rounded-full transition-all duration-300"
      :class="[i === activeDot ? 'w-6 bg-gradient-to-r from-brand to-accent shadow-sm' : 'w-2 bg-brand/15 hover:bg-brand/30']"
      @click="goToSlide(i)"
    ></button>
  </div>
</template>
