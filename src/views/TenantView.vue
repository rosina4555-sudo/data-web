<script setup>
/**
 * Tenant dashboard shell.
 *
 * A partner's own console, deliberately separate from both the admin console
 * and the partner console. Those two are operator surfaces: this one is where
 * a partner buys data, tops up and manages the keys it gave us — none of which
 * needs an operator, and none of which should be reachable with an operator's
 * token or a partner session.
 *
 * Its own tab list and its own panel registry for the same reason as the
 * partner console: an expired tenant session must land here and nowhere else,
 * and no panel from the operator's navigation is shared into it.
 */
import { ref, computed, onMounted } from 'vue'
import { tenantLogout, getTenantProfile, tenantApi, setTenantProfile } from '../services/tenantApi'
import Logo from '../components/Logo.vue'
import CreatePassword from '../components/tenant/CreatePassword.vue'
import OverviewPanel from '../components/tenant/OverviewPanel.vue'
import BuyPanel from '../components/tenant/BuyPanel.vue'
import OrdersPanel from '../components/tenant/OrdersPanel.vue'
import WalletPanel from '../components/tenant/WalletPanel.vue'
import TransactionsPanel from '../components/tenant/TransactionsPanel.vue'
import ApiKeysPanel from '../components/tenant/ApiKeysPanel.vue'
import ProfilePanel from '../components/tenant/ProfilePanel.vue'

const tabs = [
  { id: 'overview', label: 'Overview', icon: 'chart' },
  { id: 'buy', label: 'Buy data', icon: 'cart' },
  { id: 'orders', label: 'Orders', icon: 'list' },
  { id: 'wallet', label: 'Wallet', icon: 'wallet' },
  { id: 'transactions', label: 'Transactions', icon: 'receipt' },
  { id: 'keys', label: 'API keys', icon: 'key' },
  { id: 'profile', label: 'Profile', icon: 'user' },
]

const activeTab = ref('overview')
const profile = ref(getTenantProfile())

// Storage may predate the flag (a session signed in before this feature), so
// the server gets the final word before any panel renders. Until that answer
// arrives nothing mounts: a panel that fired one request before the gate
// could catch up would show a wall of refusals behind it.
const ready = ref(false)
const mustSetPassword = computed(() => !!profile.value?.must_set_password)

onMounted(async () => {
  try {
    const fresh = (await tenantApi.getProfile()).data
    if (fresh?.id) {
      profile.value = fresh
      setTenantProfile(fresh)
    }
  } catch {
    // A dead session is already handled by the request wrapper (it lands on
    // the login screen); a blip falls back to the stored profile.
  }
  ready.value = true
})

const onPasswordSet = (tenant) => {
  profile.value = tenant
}

const panels = {
  overview: OverviewPanel,
  buy: BuyPanel,
  orders: OrdersPanel,
  wallet: WalletPanel,
  transactions: TransactionsPanel,
  keys: ApiKeysPanel,
  profile: ProfilePanel,
}
const ActivePanel = computed(() => panels[activeTab.value])
</script>

<template>
  <!-- First sign-in: nothing on the dashboard exists until a password does. -->
  <CreatePassword v-if="ready && mustSetPassword" @password-set="onPasswordSet" />

  <div v-else-if="!ready" class="flex min-h-screen items-center justify-center bg-brand-dark/[0.03]">
    <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand/15 border-t-brand" />
  </div>

  <div v-else class="flex min-h-screen flex-col bg-brand-dark/[0.03] text-ink">
    <header class="sticky top-0 z-40 border-b border-brand/10 bg-surface/95 backdrop-blur-md">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16">
        <div class="flex min-w-0 items-center gap-3">
          <Logo :size="24" :text-class="'text-base font-heading font-bold tracking-tight sm:text-lg'" />
          <span class="rounded-full bg-brand/10 px-2.5 py-0.5 text-[10px] font-extrabold tracking-widest text-brand uppercase">Dashboard</span>
          <span v-if="profile?.name" class="hidden truncate text-xs font-medium text-muted sm:inline">{{ profile.name }}</span>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <a
            href="#/docs"
            class="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-ink/60 transition hover:bg-brand/5 hover:text-brand"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></svg>
            <span class="hidden sm:inline">API docs</span>
          </a>
          <span class="hidden text-[10px] font-bold tracking-widest text-muted uppercase sm:inline">Dealer dashboard</span>
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-red-500/70 transition hover:bg-red-50 hover:text-red-600"
            @click="tenantLogout()"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign out
          </button>
        </div>
      </div>

      <div class="hide-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
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
          <svg v-else-if="t.icon === 'cart'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <svg v-else-if="t.icon === 'list'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          <svg v-else-if="t.icon === 'wallet'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/><path d="M16 12h.01"/></svg>
          <svg v-else-if="t.icon === 'receipt'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/></svg>
          <svg v-else-if="t.icon === 'key'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>
          <svg v-else class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          {{ t.label }}
        </button>
      </div>
    </header>

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:py-7">
      <KeepAlive>
        <component :is="ActivePanel" />
      </KeepAlive>
    </main>
  </div>
</template>
