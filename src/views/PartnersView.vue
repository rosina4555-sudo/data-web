<script setup>
/**
 * Partner console shell.
 *
 * Deliberately its own shell with its own tab list and its own panel registry.
 * The existing admin console's navigation is not touched, and not shared: an
 * operator who lacks partner permission must never see these tabs in the main
 * console, and an operator with it must never need the main console to reach a
 * partner screen.
 */
import { ref, computed } from 'vue'
import { partnerLogout, getPartnerAdmin } from '../services/partnerApi'
import Logo from '../components/Logo.vue'
import OverviewPanel from '../components/partners/OverviewPanel.vue'
import TenantsPanel from '../components/partners/TenantsPanel.vue'
import AccountTypesPanel from '../components/partners/AccountTypesPanel.vue'
import PricingMatrixPanel from '../components/partners/PricingMatrixPanel.vue'
import ApiKeysPanel from '../components/partners/ApiKeysPanel.vue'
import WalletsPanel from '../components/partners/WalletsPanel.vue'
import SettlementsPanel from '../components/partners/SettlementsPanel.vue'

const tabs = [
  { id: 'overview', label: 'Overview', icon: 'chart' },
  { id: 'tenants', label: 'Dealers', icon: 'users' },
  { id: 'tiers', label: 'Tiers', icon: 'layers' },
  { id: 'pricing', label: 'Pricing', icon: 'tag' },
  { id: 'keys', label: 'API keys', icon: 'key' },
  { id: 'wallets', label: 'Wallets', icon: 'wallet' },
  { id: 'settlements', label: 'Settlements', icon: 'refresh' },
]

const activeTab = ref('overview')
const adminInfo = ref(getPartnerAdmin())

const panels = {
  overview: OverviewPanel,
  tenants: TenantsPanel,
  tiers: AccountTypesPanel,
  pricing: PricingMatrixPanel,
  keys: ApiKeysPanel,
  wallets: WalletsPanel,
  settlements: SettlementsPanel,
}
const ActivePanel = computed(() => panels[activeTab.value])
</script>

<template>
  <div class="flex min-h-screen flex-col bg-brand-dark/[0.03] text-ink">
    <header class="sticky top-0 z-40 border-b border-brand/10 bg-surface/95 backdrop-blur-md">
      <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16">
        <div class="flex min-w-0 items-center gap-3">
          <Logo :size="24" :text-class="'text-base font-heading font-bold tracking-tight sm:text-lg'" />
          <span class="rounded-full bg-brand/10 px-2.5 py-0.5 text-[10px] font-extrabold tracking-widest text-brand uppercase">Dealers</span>
          <span v-if="adminInfo?.email" class="hidden truncate text-xs font-medium text-muted sm:inline">{{ adminInfo.email }}</span>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <span class="hidden text-[10px] font-bold tracking-widest text-muted uppercase sm:inline">Dealer console</span>
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-red-500/70 transition hover:bg-red-50 hover:text-red-600"
            @click="partnerLogout()"
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
          <svg v-else-if="t.icon === 'users'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <svg v-else-if="t.icon === 'layers'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          <svg v-else-if="t.icon === 'tag'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.41l8.83 8.83a2 2 0 0 0 2.83 0l7.17-7.17a2 2 0 0 0 0-2.83Z"/><circle cx="7" cy="7" r="1.5"/></svg>
          <svg v-else-if="t.icon === 'key'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>
          <svg v-else-if="t.icon === 'wallet'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/><path d="M16 12h.01"/></svg>
          <svg v-else class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          {{ t.label }}
        </button>
      </div>
    </header>

    <main class="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:py-7">
      <KeepAlive>
        <component :is="ActivePanel" />
      </KeepAlive>
    </main>
  </div>
</template>
