<script setup>
/**
 * The store owner's console.
 *
 * Its own shell, its own token and its own tabs — a seller is not staff and is
 * never shown a partner or admin screen. The public shop is one link away.
 */
import { ref, computed } from 'vue'
import { storeLogout, getStore } from '../services/storeApi'
import { toast } from '../services/toast'
import Logo from '../components/Logo.vue'
import OverviewPanel from '../components/store/OverviewPanel.vue'
import PricingPanel from '../components/store/PricingPanel.vue'
import OrdersPanel from '../components/store/OrdersPanel.vue'
import EarningsPanel from '../components/store/EarningsPanel.vue'
import WithdrawalsPanel from '../components/store/WithdrawalsPanel.vue'
import ProfilePanel from '../components/store/ProfilePanel.vue'

const tabs = [
  { id: 'overview', label: 'Overview', icon: 'chart' },
  { id: 'prices', label: 'My prices', icon: 'tag' },
  { id: 'orders', label: 'Orders', icon: 'receipt' },
  { id: 'earnings', label: 'Earnings', icon: 'wallet' },
  { id: 'payouts', label: 'Payouts', icon: 'cash' },
  { id: 'settings', label: 'Shop settings', icon: 'user' },
]

const activeTab = ref('overview')
const store = ref(getStore())

const panels = {
  overview: OverviewPanel,
  prices: PricingPanel,
  orders: OrdersPanel,
  earnings: EarningsPanel,
  payouts: WithdrawalsPanel,
  settings: ProfilePanel,
}
const ActivePanel = computed(() => panels[activeTab.value])

const publicHref = computed(() => (store.value?.slug ? `#/s/${store.value.slug}` : '#/'))

const copyShopLink = async () => {
  const url = `${window.location.origin}${window.location.pathname}${publicHref.value}`
  try {
    await navigator.clipboard.writeText(url)
    toast('Shop link copied — share it with your customers.', 'success')
  } catch {
    toast('Could not copy the link. Copy it from the address bar instead.', 'error')
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-brand-dark/[0.03] text-ink">
    <header class="sticky top-0 z-40 border-b border-brand/10 bg-surface/95 backdrop-blur-md">
      <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16">
        <div class="flex min-w-0 items-center gap-3">
          <Logo :size="24" :text-class="'text-base font-heading font-bold tracking-tight sm:text-lg'" />
          <span class="rounded-full bg-brand/10 px-2.5 py-0.5 text-[10px] font-extrabold tracking-widest text-brand uppercase">Seller</span>
          <span v-if="store?.name" class="hidden truncate text-xs font-medium text-muted sm:inline">{{ store.name }}</span>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <a
            :href="publicHref"
            target="_blank"
            rel="noopener"
            class="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-brand transition hover:bg-brand-soft sm:gap-1.5 sm:px-2.5"
          >
            <span class="sm:hidden">Shop ↗</span>
            <span class="hidden sm:inline">View shop ↗</span>
          </a>
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-red-500/70 transition hover:bg-red-50 hover:text-red-600"
            @click="storeLogout()"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Logout
          </button>
        </div>
      </div>

      <div class="hide-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          class="flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all duration-200"
          :class="[
            activeTab === t.id
              ? 'bg-gradient-to-r from-brand to-brand-dark text-white shadow-md shadow-brand/25'
              : 'text-ink/55 hover:bg-brand/5 hover:text-brand',
          ]"
          @click="activeTab = t.id"
        >
          <svg v-if="t.icon === 'chart'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
          <svg v-else-if="t.icon === 'tag'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.41l8.83 8.83a2 2 0 0 0 2.83 0l7.17-7.17a2 2 0 0 0 0-2.83Z"/><circle cx="7" cy="7" r="1.5"/></svg>
          <svg v-else-if="t.icon === 'receipt'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 13H8"/><path d="M16 17H8"/><path d="M16 13h-2"/></svg>
          <svg v-else-if="t.icon === 'wallet'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/><path d="M16 12h.01"/></svg>
          <svg v-else-if="t.icon === 'cash'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01"/><path d="M18 12h.01"/></svg>
          <svg v-else class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          {{ t.label }}
        </button>
      </div>
    </header>

    <!-- The shop link is the one thing a seller needs every day, so it is
         always visible instead of buried in settings. -->
    <div class="border-b border-brand/5 bg-brand-soft/40">
      <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-[11px]">
        <span class="font-semibold text-brand-dark/70">
          Your shop: <span class="font-mono text-brand">#/s/{{ store?.slug || '…' }}</span>
        </span>
        <button type="button" class="font-bold text-brand hover:underline" @click="copyShopLink">
          Copy link
        </button>
      </div>
    </div>

    <main class="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:py-7">
      <KeepAlive>
        <component :is="ActivePanel" :key="activeTab" @go-tab="activeTab = $event" />
      </KeepAlive>
    </main>
  </div>
</template>
