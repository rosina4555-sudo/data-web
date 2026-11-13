<script setup>
import { ref, onMounted } from 'vue'
import { storeApi } from '../../services/storeApi'
import { currency, formatDateTime, statusMeta } from '../../utils/format'
import { toast } from '../../services/toast'
import StatusPill from '../StatusPill.vue'

const emit = defineEmits(['go-tab'])

const me = ref(null)
const summary = ref(null)
const recent = ref([])
const loading = ref(true)
const loadError = ref('')

const load = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const [profile, money, orders] = await Promise.all([
      storeApi.me(),
      storeApi.earningsSummary(),
      storeApi.orders({ page: 1, per_page: 5 }),
    ])
    me.value = profile.data
    summary.value = money.data
    recent.value = orders.data || []
  } catch (err) {
    loadError.value = err?.message || 'Could not load your shop.'
    toast(loadError.value, 'error')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">
          {{ me?.name || 'Your shop' }}
        </h1>
        <p class="text-xs font-medium text-muted">
          {{ me?.tagline || 'Your public shop and what it has earned.' }}
        </p>
      </div>
      <button type="button" class="rounded-xl bg-brand-soft px-3.5 py-2 text-xs font-bold text-brand transition hover:bg-brand/10" @click="load">
        ↻ Reload
      </button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand/15 border-t-brand"></div>
    </div>

    <div v-else-if="loadError" class="clay rounded-3xl bg-surface py-10 text-center">
      <p class="text-sm font-semibold text-red-600">{{ loadError }}</p>
      <button type="button" class="mt-3 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600" @click="load">Retry</button>
    </div>

    <template v-else>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div class="clay rounded-2xl bg-surface p-4">
          <p class="text-[10px] font-bold tracking-widest text-muted uppercase">Available to withdraw</p>
          <p class="mt-1 font-heading text-2xl font-black text-brand">{{ currency((summary?.available_minor || 0) / 100) }}</p>
        </div>
        <div class="clay rounded-2xl bg-surface p-4">
          <p class="text-[10px] font-bold tracking-widest text-muted uppercase">Lifetime earned</p>
          <p class="mt-1 font-heading text-2xl font-black text-brand-dark">{{ currency((summary?.lifetime_credit_minor || 0) / 100) }}</p>
        </div>
        <div class="clay rounded-2xl bg-surface p-4">
          <p class="text-[10px] font-bold tracking-widest text-muted uppercase">Orders</p>
          <p class="mt-1 font-heading text-2xl font-black text-brand-dark">{{ me?.orders_count ?? 0 }}</p>
        </div>
        <div class="clay rounded-2xl bg-surface p-4">
          <p class="text-[10px] font-bold tracking-widest text-muted uppercase">Payouts in progress</p>
          <p class="mt-1 font-heading text-2xl font-black text-brand-dark">{{ me?.pending_withdrawals ?? 0 }}</p>
        </div>
      </div>

      <div v-if="!me?.payout?.ready" class="clay flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div>
          <p class="text-sm font-bold text-amber-800">Add your payout details</p>
          <p class="mt-0.5 text-xs text-amber-700">You cannot request a withdrawal until we know where to send the money.</p>
        </div>
        <button type="button" class="rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white" @click="emit('go-tab', 'settings')">
          Set up payouts
        </button>
      </div>

      <div v-if="summary?.drift_minor" class="clay rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
        Your wallet balance is being reconciled ({{ currency(summary.drift_minor / 100) }} drift). Payouts remain accurate to the ledger; contact support if this persists.
      </div>

      <div class="clay overflow-hidden rounded-3xl bg-surface">
        <div class="flex items-center justify-between border-b border-brand/10 px-4 py-3">
          <h2 class="text-xs font-bold tracking-widest text-muted uppercase">Recent orders</h2>
          <button type="button" class="text-[11px] font-bold text-brand hover:underline" @click="emit('go-tab', 'orders')">
            View all
          </button>
        </div>

        <div v-if="!recent.length" class="px-4 py-10 text-center">
          <p class="font-heading text-sm font-bold text-brand-dark/70">No sales yet</p>
          <p class="mt-1 text-xs text-muted">Share your shop link to get your first order.</p>
        </div>

        <ul v-else class="divide-y divide-brand/5">
          <li v-for="o in recent" :key="o.reference" class="flex items-center justify-between gap-3 px-4 py-3">
            <div class="min-w-0">
              <p class="truncate font-mono text-[11px] font-bold text-brand">{{ o.reference }}</p>
              <p class="mt-0.5 truncate text-xs text-muted">{{ o.package }} · {{ o.phone }}</p>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-1">
              <span class="font-heading text-sm font-black text-brand">{{ currency(o.amount) }}</span>
              <span class="text-[10px] font-semibold text-muted">{{ formatDateTime(o.created_at) }}</span>
            </div>
            <span class="hidden shrink-0 sm:block" :title="statusMeta(o.status).label">
              <StatusPill :status="o.status" small />
            </span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
