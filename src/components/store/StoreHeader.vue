<script setup>
/**
 * The shop's own header.
 *
 * A shopper who followed a shop link should see that shop, not the
 * marketplace's navigation: no Home, API docs or seller portals compete with
 * the store. The shop page and the order-tracking page it links to both use
 * this, so moving between them never swaps the brand out from under them.
 */
import { computed } from 'vue'

const props = defineProps({
  slug: { type: String, required: true },
  name: { type: String, default: '' },
  whatsapp: { type: String, default: '' },
})

const initials = computed(() => {
  const words = String(props.name || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 'S'
  return words.slice(0, 2).map((word) => word[0].toUpperCase()).join('')
})

const whatsappLink = computed(() => {
  const digits = String(props.whatsapp || '').replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : ''
})

// Tracking stays inside the shop's context so the header does not fall back to
// the marketplace bar while someone chases up an order.
const trackHref = computed(() => `#/track?store=${encodeURIComponent(props.slug)}`)
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-brand/10 bg-surface/95 backdrop-blur-md">
    <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
      <a :href="`#/s/${slug}`" class="flex min-w-0 items-center gap-2.5" :aria-label="name || 'Shop'">
        <span class="clay-sm flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark font-heading text-sm font-extrabold text-white">
          {{ initials }}
        </span>
        <span class="min-w-0">
          <span class="block truncate font-heading text-sm font-bold tracking-tight text-brand-dark sm:text-base">
            {{ name || 'Shop' }}
          </span>
          <span class="flex items-center gap-1 text-[10px] font-semibold text-muted/70">
            <svg class="h-3 w-3 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            Verified shop on DataPadi
          </span>
        </span>
      </a>

      <nav class="flex shrink-0 items-center gap-1">
        <a :href="trackHref" class="rounded-lg px-2.5 py-2 text-xs font-bold text-brand transition hover:bg-brand-soft">
          Track order
        </a>
        <a
          v-if="whatsappLink"
          :href="whatsappLink"
          target="_blank"
          rel="noopener"
          class="clay-btn inline-flex items-center rounded-xl bg-gradient-to-r from-brand to-brand-dark px-2.5 py-2 text-xs font-bold text-white sm:px-3"
        >
          <span class="sm:hidden">WhatsApp</span>
          <span class="hidden sm:inline">Chat on WhatsApp</span>
        </a>
      </nav>
    </div>
  </header>
</template>
