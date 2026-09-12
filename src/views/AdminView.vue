<script setup>
import { ref, computed } from 'vue'
import { logout } from '../services/auth'
import { adminApi, getAdmin } from '../services/api'
import Logo from '../components/Logo.vue'
import OverviewPanel from '../components/admin/OverviewPanel.vue'
import OrdersPanel from '../components/admin/OrdersPanel.vue'
import PackagesPanel from '../components/admin/PackagesPanel.vue'
import NetworksPanel from '../components/admin/NetworksPanel.vue'
import ProvidersPanel from '../components/admin/ProvidersPanel.vue'
import WebhooksPanel from '../components/admin/WebhooksPanel.vue'

defineEmits(['logout'])

const tabs = [
  { id: 'overview', label: 'Overview', icon: 'chart' },
  { id: 'orders', label: 'Orders', icon: 'receipt' },
  { id: 'packages', label: 'Bundles', icon: 'drop' },
  { id: 'networks', label: 'Networks', icon: 'signal' },
  { id: 'providers', label: 'Providers', icon: 'server' },
  { id: 'webhooks', label: 'Webhooks', icon: 'webhook' },
]
const activeTab = ref('overview')
const adminInfo = ref(getAdmin())

const panels = {
  overview: OverviewPanel,
  orders: OrdersPanel,
  packages: PackagesPanel,
  networks: NetworksPanel,
  providers: ProvidersPanel,
  webhooks: WebhooksPanel,
}
const ActivePanel = computed(() => panels[activeTab.value])
</script>

<template>
  <div class="flex min-h-screen flex-col bg-brand-dark/[0.03] text-ink">
    <!-- Header -->
    <header class="sticky top-0 z-40 border-b border-brand/10 bg-surface/95 backdrop-blur-md">
      <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16">
        <div class="flex min-w-0 items-center gap-3">
          <Logo :size="24" :text-class="'text-base font-heading font-bold tracking-tight sm:text-lg'" />
          <span class="rounded-full bg-brand/10 px-2.5 py-0.5 text-[10px] font-extrabold tracking-widest text-brand uppercase">Admin</span>
          <span v-if="adminInfo?.email" class="hidden truncate text-xs font-medium text-muted sm:inline">{{ adminInfo.email }}</span>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <span class="hidden text-[10px] font-bold tracking-widest text-muted uppercase sm:inline">Console</span>
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-red-500/70 transition hover:bg-red-50 hover:text-red-600"
            @click="logout()"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Logout
          </button>
        </div>
      </div>
      <!-- Tab bar -->
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
          <svg v-else-if="t.icon === 'receipt'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 13H8"/><path d="M16 17H8"/><path d="M16 13h-2"/></svg>
          <svg v-else-if="t.icon === 'drop'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69 17.66 8.35a8 8 0 1 1-11.31 0z"/></svg>
          <svg v-else-if="t.icon === 'signal'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><rect x="2.5" y="15" width="3" height="5.5" rx="1"/><rect x="8.5" y="11" width="3" height="9.5" rx="1"/><rect x="14.5" y="7" width="3" height="13.5" rx="1"/></svg>
          <svg v-else-if="t.icon === 'webhook'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m16 8-2 6"/><path d="m8 8 2 6"/><path d="M12 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/></svg>
          <svg v-else class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
          {{ t.label }}
        </button>
      </div>
    </header>

    <!-- Panel -->
    <main class="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:py-7">
      <KeepAlive>
        <component :is="ActivePanel" />
      </KeepAlive>
    </main>
  </div>
</template>