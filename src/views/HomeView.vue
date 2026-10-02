<script setup>
import { ref, computed, onMounted } from 'vue'
import { SITE, NETWORK_COLORS } from '../site'
import { NETWORK_DOT } from '../utils/format'
import { api } from '../services/api'
import { currency } from '../utils/format'
import PackageCard from '../components/PackageCard.vue'
import CheckoutModal from '../components/CheckoutModal.vue'
import Logo from '../components/Logo.vue'

const searchQuery = ref('')
const networks = ref([])
const selectedNetwork = ref(null)
const packages = ref([])
const packagesLoading = ref(true)
const packagesError = ref('')
const activeDot = ref(0)
const carouselEl = ref(null)
const checkout = ref(null) // { network, pkg }

const loading = ref(true)
const loadError = ref('')

// Refund-policy notice (shown on first visit, dismissible)
const REFUND_POLICY_URL = 'https://support.paystack.com/en/articles/2127106'
const REFUND_NOTICE_KEY = 'dp_refund_notice_dismissed'
const noticeDismissed = ref(
  typeof localStorage !== 'undefined' && localStorage.getItem(REFUND_NOTICE_KEY) === '1',
)
const dismissNotice = () => {
  noticeDismissed.value = true
  try {
    localStorage.setItem(REFUND_NOTICE_KEY, '1')
  } catch {
    /* private mode — just hide for this visit */
  }
}

onMounted(async () => {
  try {
    const res = await api.getNetworks()
    networks.value = res.data || res.networks || []
    if (networks.value.length) selectNetwork(networks.value[0])
  } catch (err) {
    loadError.value = err?.message || 'Failed to load networks.'
  } finally {
    loading.value = false
  }
})

const selectNetwork = (network) => {
  if (!network) return
  selectedNetwork.value = network
  loadPackages(network.id)
}

const loadPackages = async (id, silent = false) => {
  packagesLoading.value = true
  packagesError.value = ''
  activeDot.value = 0
  if (!silent) packages.value = []
  try {
    const res = await api.getPackages(id)
    packages.value = res.data || res.packages || []
  } catch (err) {
    packagesError.value = err?.message || 'Failed to load bundles. Please refresh.'
  } finally {
    packagesLoading.value = false
  }
}

const filteredPackages = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return packages.value
  return packages.value.filter(
    (p) =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.provider_package?.size_label || '').toLowerCase().includes(q),
  )
})

const featuredIndex = computed(() => {
  let best = 0
  let bestSize = -1
  filteredPackages.value.forEach((p, i) => {
    const m = (p.name || '').match(/(\d+(?:\.\d+)?)\s*[GMK]B/i)
    const size = m ? parseFloat(m[1]) * (m[0].toUpperCase().includes('G') ? 1024 : m[0].toUpperCase().includes('M') ? 1 : 1 / 1024) : 0
    if (size > bestSize) {
      bestSize = size
      best = i
    }
  })
  return best
})

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
  el.scrollTo({ left: el.children[i].offsetLeft - (el.clientWidth - el.children[i].offsetWidth) / 2, behavior: 'smooth' })
}

const handleBuy = (pkg) => {
  checkout.value = { network: selectedNetwork.value, pkg }
  window.dispatchEvent(new CustomEvent('dp:scroll-lock', { detail: true }))
}

const closeCheckout = () => {
  checkout.value = null
  window.dispatchEvent(new CustomEvent('dp:scroll-lock', { detail: false }))
}

const goTrack = (ref = '') => {
  closeCheckout()
  window.location.hash = ref ? `#/track?ref=${encodeURIComponent(ref)}` : '#/track'
}

const priceSummary = computed(() => {
  if (!packages.value.length) return '—'
  const prices = packages.value.map((p) => Number(p.sell_price || 0))
  return `${currency(Math.min(...prices))} – ${currency(Math.max(...prices))}`
})
</script>

<template>
  <div class="flex min-h-screen flex-col text-ink">
    <!-- Header -->
    <header class="sticky top-0 z-40 border-b border-brand/10 bg-surface/90 backdrop-blur-md">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16">
        <a href="#/" aria-label="DataPadi home" class="flex shrink-0 items-center">
          <Logo :size="28" :text-class="'text-lg font-heading font-bold tracking-tight sm:text-xl'" />
        </a>
        <nav class="flex items-center gap-3 text-sm font-semibold sm:gap-5">
          <a href="#/" class="text-brand transition-colors hover:text-accent-dark">Home</a>
          <a href="#/track" class="flex items-center gap-1.5 text-ink/60 transition-colors hover:text-brand">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>
            <span class="hidden sm:inline">Track order</span>
            <span class="sm:hidden">Track</span>
          </a>
          <a href="#/admin" class="hidden items-center gap-1.5 rounded-xl bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand transition hover:bg-brand/10 sm:flex">Admin</a>
        </nav>
      </div>
    </header>

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:py-8">
      <!-- Hero -->
      <section class="relative isolate shrink-0 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-dark via-brand to-accent px-5 py-7 text-center text-white sm:px-8 sm:py-12 md:rounded-[2rem]">
        <div class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,#ffffff26,transparent_55%)]"></div>
        <div class="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>
        <div class="pointer-events-none absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-white/10 blur-2xl"></div>

        <span class="clay-sm inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-extrabold tracking-widest text-white/90 uppercase">
          <svg class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><rect x="2.5" y="15" width="3" height="5.5" rx="1"/><rect x="8.5" y="11" width="3" height="9.5" rx="1"/><rect x="14.5" y="7" width="3" height="13.5" rx="1"/></svg>
          {{ SITE.networksServed }}
        </span>

        <h1 class="font-heading mt-3 text-2xl leading-tight font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
          {{ SITE.heroTitle }}
        </h1>
        <p class="mx-auto mt-2 hidden max-w-lg text-sm leading-relaxed text-white/85 sm:block sm:mt-3 sm:text-base">
          {{ SITE.heroSub }}
        </p>

        <form class="mx-auto mt-4 flex w-full max-w-md items-center gap-2 sm:mt-6 sm:gap-3" @submit.prevent="selectNetwork(selectedNetwork)">
          <div class="relative flex-1">
            <svg class="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              v-model="searchQuery"
              type="search"
              placeholder="Search bundles, e.g. 1GB…"
              class="w-full rounded-2xl border border-white/15 bg-black/15 py-3 pr-4 pl-10 text-sm font-medium text-white placeholder:text-white/55 focus:border-white/35 focus:outline-none"
            />
          </div>
          <button type="submit" class="clay-btn-light shrink-0 rounded-2xl bg-surface px-5 py-3 text-sm font-extrabold text-brand sm:px-7">Search</button>
        </form>

        <div class="mx-auto mt-5 flex max-w-md items-center justify-center gap-4 text-center sm:mt-6">
          <div>
            <p class="font-heading text-sm font-black text-white sm:text-lg">{{ networks.length }}</p>
            <p class="text-[10px] font-bold tracking-widest text-white/70 uppercase">Networks</p>
          </div>
          <span class="h-8 w-px bg-white/25"></span>
          <div>
            <p class="font-heading text-sm font-black text-white sm:text-lg">{{ packages.length || '—' }}</p>
            <p class="text-[10px] font-bold tracking-widest text-white/70 uppercase">Bundles</p>
          </div>
          <span class="h-8 w-px bg-white/25"></span>
          <div>
            <p class="font-heading text-sm font-black text-white sm:text-lg">{{ priceSummary }}</p>
            <p class="text-[10px] font-bold tracking-widest text-white/70 uppercase">Price range</p>
          </div>
        </div>
      </section>

      <!-- Refund guarantee notice -->
      <section v-if="!noticeDismissed" class="mt-5 sm:mt-8">
        <div class="clay relative overflow-hidden rounded-3xl border border-brand/10 bg-gradient-to-br from-brand-soft via-surface to-accent-soft px-4 py-4 sm:px-6 sm:py-5">
          <div class="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-accent/10 blur-2xl"></div>
          <button
            type="button"
            aria-label="Dismiss refund notice"
            class="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-xl bg-surface/80 text-muted transition hover:bg-surface hover:text-brand"
            @click="dismissNotice"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>

          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <span class="clay-sm flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
            </span>

            <div class="min-w-0 flex-1">
              <p class="font-heading text-sm font-bold tracking-tight text-brand-dark sm:text-base">Refund guarantee — we've got you covered</p>
              <p class="mt-1 text-xs leading-relaxed text-ink/70 sm:text-sm">
                Data is delivered in seconds. Orders only fail when a phone number can't be verified — and when that happens, we refund you automatically.
              </p>
              <ul class="mt-2 grid gap-x-4 gap-y-1.5 text-xs font-medium text-ink/70 sm:grid-cols-2 sm:text-[13px]">
                <li class="flex items-center gap-1.5">
                  <svg class="h-3.5 w-3.5 shrink-0 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  Refunded through Paystack, securely
                </li>
                <li class="flex items-center gap-1.5">
                  <svg class="h-3.5 w-3.5 shrink-0 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  Instant delivery in seconds
                </li>
                <li class="flex items-center gap-1.5">
                  <svg class="h-3.5 w-3.5 shrink-0 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  Only unverified numbers fail — and they're refunded
                </li>
              </ul>
            </div>

            <a
              :href="REFUND_POLICY_URL"
              target="_blank"
              rel="noopener noreferrer"
              class="clay-btn self-start shrink-0 rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2.5 text-center text-xs font-extrabold text-white sm:self-auto"
            >
              Read Paystack's refund policy ↗
            </a>
          </div>
        </div>
      </section>

      <!-- Loading / error for networks -->
      <section v-if="loading" class="mt-6 sm:mt-10">
        <div class="flex items-center justify-center py-14">
          <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand/15 border-t-brand"></div>
        </div>
      </section>

      <section v-else-if="loadError" class="mt-6 sm:mt-10">
        <div class="clay flex flex-col items-center justify-center rounded-3xl bg-surface py-12 text-center">
          <p class="font-heading text-base font-bold text-red-600">Could not load bundles</p>
          <p class="mt-1 text-sm text-muted">{{ loadError }}</p>
          <button type="button" class="mt-3 rounded-xl bg-red-50 px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100" @click="window.location.reload()">Retry</button>
        </div>
      </section>

      <template v-else>
        <!-- Network picker -->
        <section class="mt-6 sm:mt-10">
          <div class="mb-2.5 flex items-end justify-between gap-4 sm:mb-4">
            <h2 class="font-heading text-base font-bold tracking-tight text-brand-dark sm:text-xl lg:text-2xl">Choose your network</h2>
            <p class="hidden text-xs font-medium text-muted sm:block">{{ networks.length }} networks · tap to load bundles</p>
          </div>
          <div class="hide-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            <button
              v-for="n in networks"
              :key="n.id"
              type="button"
              class="clay-sm flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold transition-all duration-200"
              :class="selectedNetwork?.id === n.id
                ? 'border-transparent bg-gradient-to-r from-brand to-brand-dark text-white'
                : 'border-brand/10 bg-surface text-brand-dark hover:border-brand/25'"
              @click="selectNetwork(n)"
            >
              <span class="h-2 w-2 rounded-full" :class="selectedNetwork?.id === n.id ? 'bg-accent' : NETWORK_DOT[n.code] || 'bg-brand/40'"></span>
              {{ n.code }}
              <span class="hidden font-medium opacity-70 sm:inline">{{ n.name }}</span>
            </button>
          </div>
        </section>

        <!-- Packages -->
        <section class="mt-5 sm:mt-8">
          <div class="mb-2.5 flex shrink-0 items-end justify-between gap-4 sm:mb-5">
            <h2 class="font-heading text-base font-bold tracking-tight text-brand-dark sm:text-xl lg:text-2xl">
              {{ selectedNetwork?.code }} bundles
            </h2>
            <p v-if="!packagesLoading" class="text-xs font-medium text-muted sm:text-sm">
              {{ filteredPackages.length }} {{ filteredPackages.length === 1 ? 'bundle' : 'bundles' }}
            </p>
          </div>

          <div v-if="packagesLoading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
            <div v-for="i in 3" :key="i" class="clay h-72 animate-pulse rounded-3xl bg-surface"></div>
          </div>

          <div v-else-if="packagesError" class="clay flex items-center justify-center gap-3 rounded-3xl bg-surface py-10 text-center">
            <p class="text-sm font-semibold text-red-600">{{ packagesError }}</p>
            <button type="button" class="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100" @click="loadPackages(selectedNetwork.id, true)">Retry</button>
          </div>

          <!-- Mobile carousel / desktop grid (richwifi pattern) -->
          <template v-else-if="filteredPackages.length">
            <div
              ref="carouselEl"
              class="hide-scrollbar -mx-4 flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto scroll-p-6 px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 lg:grid-cols-3 lg:gap-6"
              @scroll.passive="onCarouselScroll"
            >
              <div
                v-for="(pkg, i) in filteredPackages"
                :key="pkg.id"
                class="w-[84vw] max-w-[21rem] shrink-0 snap-center last:snap-end md:w-full md:max-w-none md:shrink"
              >
                <PackageCard
                  :network="selectedNetwork"
                  :pkg="pkg"
                  :featured="i === featuredIndex && filteredPackages.length > 1"
                  @buy="handleBuy"
                />
              </div>
            </div>

            <!-- Dot indicators (mobile) -->
            <div v-if="filteredPackages.length > 1" class="mt-3 flex shrink-0 items-center justify-center gap-2 md:hidden">
              <button
                v-for="(_, i) in filteredPackages"
                :key="i"
                type="button"
                :aria-label="`Go to bundle ${i + 1}`"
                class="h-2 rounded-full transition-all duration-300"
                :class="[i === activeDot ? 'w-6 bg-gradient-to-r from-brand to-accent shadow-sm' : 'w-2 bg-brand/15 hover:bg-brand/30']"
                @click="goToSlide(i)"
              ></button>
            </div>
          </template>

          <div v-else class="clay flex flex-col items-center justify-center rounded-3xl bg-surface py-10 text-center">
            <p class="font-heading text-base font-bold text-brand-dark/70">No bundles for {{ selectedNetwork?.code }}</p>
            <p class="mt-1 text-sm text-muted">Try another network.</p>
          </div>
        </section>

        <!-- How it works -->
        <section class="mt-8 sm:mt-14">
          <h2 class="font-heading text-center text-lg font-bold tracking-tight text-brand-dark sm:text-2xl">How it works</h2>
          <div class="mt-4 grid gap-3 sm:mt-6 sm:grid-cols-3 sm:gap-5">
            <div class="clay flex items-start gap-3 rounded-2xl bg-surface p-4 sm:flex-col sm:gap-3 sm:p-5">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white">
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>
              </span>
              <div>
                <p class="font-heading text-sm font-bold text-brand-dark sm:text-base">1 · Pick a bundle</p>
                <p class="mt-0.5 text-xs leading-relaxed text-muted sm:text-sm">Choose your network and data size. Prices are shown upfront, no surprises.</p>
              </div>
            </div>
            <div class="clay flex items-start gap-3 rounded-2xl bg-surface p-4 sm:flex-col sm:gap-3 sm:p-5">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-white">
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11h18l-2 9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
              </span>
              <div>
                <p class="font-heading text-sm font-bold text-brand-dark sm:text-base">2 · Pay safely</p>
                <p class="mt-0.5 text-xs leading-relaxed text-muted sm:text-sm">Pay with Mobile Money or card — powered securely by Paystack, in the app.</p>
              </div>
            </div>
            <div class="clay flex items-start gap-3 rounded-2xl bg-surface p-4 sm:flex-col sm:gap-3 sm:p-5">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-accent text-white">
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor" stroke="none"/></svg>
              </span>
              <div>
                <p class="font-heading text-sm font-bold text-brand-dark sm:text-base">3 · Get connected</p>
                <p class="mt-0.5 text-xs leading-relaxed text-muted sm:text-sm">Your number is topped up automatically in seconds. Track every order anytime.</p>
              </div>
            </div>
          </div>
        </section>
      </template>
    </main>

    <!-- Footer -->
    <footer class="mt-8 shrink-0 border-t border-brand/10 bg-surface sm:mt-12">
      <div class="mx-auto max-w-6xl px-4 py-6 sm:py-10">
        <div class="flex flex-col items-start justify-between gap-6 sm:flex-row sm:gap-8">
          <div class="max-w-sm">
            <Logo :size="26" :text-class="'text-lg font-heading font-bold tracking-tight'" />
            <p class="mt-2 text-xs leading-relaxed text-muted sm:text-sm">{{ SITE.tagline }}. Pay with mobile money or card and get connected in seconds.</p>
          </div>
          <div class="flex flex-wrap gap-10 sm:gap-14">
            <div>
              <h3 class="font-heading text-xs font-bold tracking-widest text-brand uppercase">Explore</h3>
              <ul class="mt-2.5 space-y-2 text-sm font-medium text-ink/60">
                <li><a href="#/" class="transition-colors hover:text-brand">Bundles</a></li>
                <li><a href="#/track" class="transition-colors hover:text-brand">Track order</a></li>
                <li><a href="#/admin" class="transition-colors hover:text-brand">Admin</a></li>
              </ul>
            </div>
            <div>
              <h3 class="font-heading text-xs font-bold tracking-widest text-brand uppercase">Support</h3>
              <ul class="mt-2.5 space-y-2 text-sm font-medium text-ink/60">
                <li><a :href="`mailto:${SITE.supportEmail}`" class="transition-colors hover:text-brand">{{ SITE.supportEmail }}</a></li>
                <li><a :href="`tel:${SITE.supportPhone.replace(/\s/g, '')}`" class="transition-colors hover:text-brand">{{ SITE.supportPhone }}</a></li>
              </ul>
            </div>
          </div>
        </div>
        <p class="mt-6 border-t border-brand/10 pt-4 text-center text-[11px] font-medium text-muted/70">{{ SITE.copyright }}</p>
      </div>
    </footer>

    <!-- Purchase modal -->
    <CheckoutModal v-if="checkout" :network="checkout.network" :pkg="checkout.pkg" @close="closeCheckout" @track="goTrack" />
  </div>
</template>