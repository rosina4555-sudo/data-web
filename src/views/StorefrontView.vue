<script setup>
/**
 * A store owner's public shop.
 *
 * Everything sold here belongs to one store: the price shown is their price,
 * and checkout creates the order against their storefront so profit is
 * credited to them on delivery. The page needs no session and never receives
 * the platform's base price — only what the shop charges.
 */
import { ref, computed, watch } from 'vue'
import { storefrontApi } from '../services/storeApi'
import { currency, NETWORK_DOT } from '../utils/format'
import { toast } from '../services/toast'
import PackageCard from '../components/PackageCard.vue'
import CheckoutModal from '../components/CheckoutModal.vue'
import Logo from '../components/Logo.vue'

const props = defineProps({
  slug: { type: String, required: true },
})

const store = ref(null)
const catalog = ref([])
const loading = ref(true)
const error = ref('')
const checkout = ref(null)

const networks = computed(() => {
  const groups = new Map()

  for (const row of catalog.value) {
    const code = row.network?.code || 'OTHER'
    if (!groups.has(code)) {
      groups.set(code, { code, name: row.network?.name || code, packages: [] })
    }
    groups.get(code).packages.push(row)
  }

  return [...groups.values()]
})

const bundleCount = computed(() => catalog.value.length)
const fromPrice = computed(() => {
  if (!catalog.value.length) return '—'
  return currency(Math.min(...catalog.value.map((row) => Number(row.price_minor || 0) / 100)))
})

// The shop is the brand here, so the header carries the store's own name and
// initials rather than the platform logo and its marketplace links.
const initials = computed(() => {
  const words = String(store.value?.name || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 'S'
  return words.slice(0, 2).map((word) => word[0].toUpperCase()).join('')
})

const whatsappLink = computed(() => {
  const digits = String(store.value?.whatsapp || '').replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : ''
})

const load = async () => {
  loading.value = true
  error.value = ''

  try {
    const [profile, packages] = await Promise.all([
      storefrontApi.get(props.slug),
      storefrontApi.packages(props.slug),
    ])
    store.value = profile.store
    catalog.value = packages.packages || []
  } catch (err) {
    error.value = err?.message || 'This storefront could not be loaded.'
  } finally {
    loading.value = false
  }
}

watch(() => props.slug, load, { immediate: true })

// PackageCard was built for the retail catalog, so the shop's own shape is
// translated here rather than forking the card.
const toCard = (row) => ({
  id: row.package_id,
  name: row.name,
  sell_price: Number(row.price_minor || 0) / 100,
  size_label: row.size_label,
})

const openCheckout = (row, network) => {
  checkout.value = {
    network: { code: network.code, name: network.name },
    pkg: { ...toCard(row), name: row.name },
    row,
  }
  window.dispatchEvent(new CustomEvent('dp:scroll-lock', { detail: true }))
}

const closeCheckout = () => {
  checkout.value = null
  window.dispatchEvent(new CustomEvent('dp:scroll-lock', { detail: false }))
}

const createStoreOrder = (phone, key) =>
  storefrontApi.createOrder(props.slug, checkout.value.row.package_id, phone, key)

const goTrack = (ref = '') => {
  closeCheckout()
  window.location.hash = ref ? `#/track?ref=${encodeURIComponent(ref)}` : '#/track'
}

const share = async () => {
  const url = `${window.location.origin}${window.location.pathname}#/s/${props.slug}`
  try {
    if (navigator.share) {
      await navigator.share({ title: store.value?.name || 'Storefront', url })
      return
    }
    await navigator.clipboard.writeText(url)
    toast('Store link copied.', 'success')
  } catch {
    // Sharing was cancelled, or the clipboard is unavailable. Neither is an
    // error worth interrupting the shopper for.
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col text-ink">
    <!-- Store-branded header. A shopper who followed a shop link should see
         that shop, not the marketplace's navigation: no Home, API docs or
         seller portals compete with the store here. -->
    <header class="sticky top-0 z-40 border-b border-brand/10 bg-surface/95 backdrop-blur-md">
      <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <a :href="`#/s/${slug}`" class="flex min-w-0 items-center gap-2.5" :aria-label="store?.name || 'Shop'"
        >
          <span class="clay-sm flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark font-heading text-sm font-extrabold text-white">
            {{ initials }}
          </span>
          <span class="min-w-0">
            <span class="block truncate font-heading text-sm font-bold tracking-tight text-brand-dark sm:text-base">
              {{ store?.name || 'Shop' }}
            </span>
            <span class="flex items-center gap-1 text-[10px] font-semibold text-muted/70">
              <svg class="h-3 w-3 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              Verified shop on DataPadi
            </span>
          </span>
        </a>

        <nav class="flex shrink-0 items-center gap-1">
          <a href="#/track" class="rounded-lg px-2.5 py-2 text-xs font-bold text-brand transition hover:bg-brand-soft">
            Track order
          </a>
          <a
            v-if="whatsappLink"
            :href="whatsappLink"
            target="_blank"
            rel="noopener"
            class="clay-btn hidden rounded-xl bg-gradient-to-r from-brand to-brand-dark px-3 py-2 text-xs font-bold text-white sm:inline-block"
          >
            Chat on WhatsApp
          </a>
        </nav>
      </div>
    </header>

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:py-8">
      <div v-if="loading" class="flex items-center justify-center py-24">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand/15 border-t-brand"></div>
      </div>

      <section v-else-if="error" class="clay mx-auto max-w-md rounded-3xl bg-surface px-6 py-12 text-center">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
        </div>
        <h1 class="mt-4 font-heading text-lg font-bold text-brand-dark">Shop unavailable</h1>
        <p class="mt-1 text-sm text-muted">{{ error }}</p>
        <a href="#/" class="clay-btn mt-5 inline-block rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2.5 text-xs font-bold text-white">
          Browse DataPadi instead
        </a>
      </section>

      <template v-else-if="store">
        <!-- Shop hero. It stays a shop, not a DataPadi page: the store's name
             leads, with the platform reduced to a small trust mark. -->
        <section class="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-brand-dark via-brand to-accent px-5 py-7 text-white sm:px-8 sm:py-10 md:rounded-[2rem]">
          <div class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,#ffffff26,transparent_55%)]"></div>
          <div class="pointer-events-none absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-white/10 blur-2xl"></div>

          <div class="flex flex-wrap items-center justify-between gap-3">
            <span class="clay-sm inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold tracking-wider text-white/90 uppercase">
              <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18"/><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="m12 3 4 3H8z"/></svg>
              Verified storefront
            </span>
            <div class="flex items-center gap-2">
              <a
                v-if="whatsappLink"
                :href="whatsappLink"
                target="_blank"
                rel="noopener"
                class="clay-sm rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/25"
              >
                Chat on WhatsApp
              </a>
              <button
                type="button"
                class="clay-sm rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/25"
                @click="share"
              >
                Share shop
              </button>
            </div>
          </div>

          <h1 class="font-heading mt-4 text-2xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">
            {{ store.name }}
          </h1>
          <p v-if="store.tagline" class="mt-1.5 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
            {{ store.tagline }}
          </p>
          <p v-if="store.description" class="mt-3 max-w-xl text-xs leading-relaxed whitespace-pre-line text-white/70 sm:text-sm">
            {{ store.description }}
          </p>

          <dl class="mt-6 grid max-w-md grid-cols-3 gap-2 text-center sm:gap-3">
            <div class="rounded-2xl bg-black/15 px-2 py-2.5">
              <dt class="text-[9px] font-bold tracking-wider text-white/60 uppercase">Bundles</dt>
              <dd class="font-heading text-lg font-bold">{{ bundleCount }}</dd>
            </div>
            <div class="rounded-2xl bg-black/15 px-2 py-2.5">
              <dt class="text-[9px] font-bold tracking-wider text-white/60 uppercase">From</dt>
              <dd class="font-heading text-lg font-bold">{{ fromPrice }}</dd>
            </div>
            <div class="rounded-2xl bg-black/15 px-2 py-2.5">
              <dt class="text-[9px] font-bold tracking-wider text-white/60 uppercase">Delivery</dt>
              <dd class="font-heading text-lg font-bold">Instant</dd>
            </div>
          </dl>
        </section>

        <!-- Catalog -->
        <section v-if="networks.length" class="mt-7 space-y-8">
          <div v-for="network in networks" :key="network.code">
            <div class="flex items-center justify-between gap-2">
              <h2 class="font-heading flex items-center gap-2 text-base font-bold tracking-tight text-brand-dark sm:text-xl">
                <span class="h-2.5 w-2.5 rounded-full" :class="NETWORK_DOT[network.code] || 'bg-brand'"></span>
                {{ network.name }}
              </h2>
              <span class="text-[11px] font-semibold text-muted">{{ network.packages.length }} bundle{{ network.packages.length === 1 ? '' : 's' }}</span>
            </div>

            <div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <PackageCard
                v-for="row in network.packages"
                :key="row.package_id"
                :network="{ code: network.code, name: network.name }"
                :pkg="toCard(row)"
                @buy="openCheckout(row, network)"
              />
            </div>
          </div>
        </section>

        <section v-else class="clay mt-7 rounded-3xl bg-surface px-6 py-14 text-center">
          <p class="font-heading text-base font-bold text-brand-dark/70">This shop has no bundles on sale right now</p>
          <p class="mt-1 text-sm text-muted">Check back later, or contact the shop directly.</p>
        </section>

        <footer class="mt-10 rounded-3xl border border-brand/10 bg-surface px-5 py-5 text-center">
          <div class="flex items-center justify-center gap-2 text-xs font-semibold text-muted">
            <Logo :size="18" :text-class="'text-sm font-heading font-bold tracking-tight'" />
            <span aria-hidden="true">·</span>
            <span>Payment and delivery by DataPadi</span>
          </div>
          <p class="mt-2 text-[11px] text-muted/70">
            Problems with an order? Use
            <a href="#/track" class="font-semibold text-brand hover:underline">Track order</a>
            with the reference from your receipt.
          </p>
        </footer>
      </template>
    </main>

    <CheckoutModal
      v-if="checkout"
      :network="checkout.network"
      :pkg="checkout.pkg"
      :create-order="createStoreOrder"
      @close="closeCheckout"
      @track="goTrack"
    />
  </div>
</template>
