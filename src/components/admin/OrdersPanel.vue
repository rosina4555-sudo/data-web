<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '../../services/api'
import { currency, formatDateTime } from '../../utils/format'
import { toast } from '../../services/toast'
import StatusPill from '../StatusPill.vue'
import Pagination from './Pagination.vue'
import OrderDetailSheet from './OrderDetailSheet.vue'

const rows = ref([])
const loading = ref(true)
const loadError = ref('')
const meta = ref({ current_page: 1, last_page: 1, total: 0 })

const providers = ref([])
const filters = ref({ status: '', phone: '', ref: '', provider_id: '', from: '', to: '' })
const activeDetail = ref(null)

const STATUSES = ['PENDING_PAYMENT', 'PAID', 'SUBMITTED', 'SUCCESS', 'FAILED', 'SUPERVISED', 'EXPIRED']

const loadCore = async () => {
  loading.value = true
  loadError.value = ''
  const params = { page: meta.value.current_page, per_page: 15 }
  for (const [k, v] of Object.entries(filters.value)) {
    if (v) params[k] = v
  }
  try {
    const res = await adminApi.getOrders(params)
    rows.value = res.data || []
    meta.value = res.meta || meta.value
  } catch (err) {
    loadError.value = err?.message || 'Failed to load orders.'
    toast(loadError.value, 'error')
  } finally {
    loading.value = false
  }
}

const applyFilters = () => {
  meta.value = { current_page: 1, last_page: 1, total: 0 }
  loadCore()
}

const resetFilters = () => {
  filters.value = { status: '', phone: '', ref: '', provider_id: '', from: '', to: '' }
  applyFilters()
}

const page = (p) => {
  meta.value.current_page = p
  loadCore()
}

const openDetail = (id) => (activeDetail.value = id)

const loadProviders = async () => {
  try {
    const res = await adminApi.getProviders({ per_page: 100 })
    const list = res.data || []
    if (Array.isArray(list)) providers.value = list
    else providers.value = []
  } catch {}
}

onMounted(() => {
  loadProviders()
  loadCore()
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Orders</h1>
        <p class="text-xs font-medium text-muted">{{ meta.total }} total</p>
      </div>
      <button
        type="button"
        class="rounded-xl bg-brand-soft px-3.5 py-2 text-xs font-bold text-brand transition hover:bg-brand/10"
        @click="loadCore()"
      >
        ↻ Reload
      </button>
    </div>

    <!-- Filters -->
    <div class="clay flex flex-wrap items-end gap-2.5 rounded-2xl bg-surface p-3.5 sm:p-4">
      <label class="min-w-[9rem] flex-1">
        <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Status</span>
        <select v-model="filters.status" class="clay-well w-full rounded-xl bg-bg px-3 py-2 text-xs font-semibold text-brand-dark outline-none">
          <option value="">All</option>
          <option v-for="s in STATUSES" :key="s" :value="s">{{ s }}</option>
        </select>
      </label>
      <label class="min-w-[8rem] flex-1">
        <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Phone</span>
        <input v-model="filters.phone" type="tel" placeholder="024…" class="clay-well w-full rounded-xl bg-bg px-3 py-2 text-xs font-medium text-brand-dark outline-none placeholder:text-muted/40" />
      </label>
      <label class="min-w-[9rem] flex-1">
        <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Reference</span>
        <input v-model="filters.ref" type="text" placeholder="TB-…" class="clay-well w-full rounded-xl bg-bg px-3 py-2 font-mono text-xs font-medium text-brand-dark outline-none placeholder:text-muted/40" />
      </label>
      <label class="min-w-[8rem] flex-1">
        <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Provider</span>
        <select v-model="filters.provider_id" class="clay-well w-full rounded-xl bg-bg px-3 py-2 text-xs font-semibold text-brand-dark outline-none">
          <option value="">All</option>
          <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </label>
      <label class="w-[7.5rem]">
        <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">From</span>
        <input v-model="filters.from" type="date" class="clay-well w-full rounded-xl bg-bg px-3 py-2 text-xs font-medium text-brand-dark outline-none" />
      </label>
      <label class="w-[7.5rem]">
        <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">To</span>
        <input v-model="filters.to" type="date" class="clay-well w-full rounded-xl bg-bg px-3 py-2 text-xs font-medium text-brand-dark outline-none" />
      </label>
      <div class="flex gap-2">
        <button type="button" class="clay-btn rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-xs font-extrabold text-white transition" @click="applyFilters">Apply</button>
        <button type="button" class="clay-btn-light rounded-xl bg-surface px-3 py-2 text-xs font-bold text-muted transition hover:text-brand" @click="resetFilters">Reset</button>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand/15 border-t-brand"></div>
    </div>

    <div v-else-if="loadError" class="clay flex items-center justify-center gap-3 rounded-3xl bg-surface py-10 text-center">
      <p class="text-sm font-semibold text-red-600">{{ loadError }}</p>
      <button type="button" class="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100" @click="loadCore">Retry</button>
    </div>

    <template v-else>
      <div v-if="!rows.length" class="clay rounded-3xl bg-surface py-14 text-center">
        <p class="font-heading text-base font-bold text-brand-dark/70">No orders match</p>
        <p class="mt-1 text-sm text-muted">Try widening your filters.</p>
      </div>

      <!-- Desktop table -->
      <div v-if="rows.length" class="clay hidden overflow-hidden rounded-3xl bg-surface lg:block">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-brand/10 bg-bg/60 text-[10px] font-extrabold tracking-widest text-muted uppercase">
              <th class="px-4 py-3">Reference</th>
              <th class="px-4 py-3">Bundle</th>
              <th class="px-4 py-3">Network</th>
              <th class="px-4 py-3">Phone</th>
              <th class="px-4 py-3">Provider</th>
              <th class="px-4 py-3 text-right">Amount</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in rows" :key="o.id" class="border-b border-brand/5 transition hover:bg-brand-soft/40">
              <td class="px-4 py-3">
                <button type="button" class="font-mono font-bold text-brand hover:underline" @click="openDetail(o.id)">{{ o.reference }}</button>
              </td>
              <td class="px-4 py-3 font-semibold text-brand-dark">{{ o.package }}</td>
              <td class="px-4 py-3"><span class="rounded bg-brand-soft px-1.5 py-0.5 font-extrabold text-brand">{{ o.network || '—' }}</span></td>
              <td class="px-4 py-3 font-medium text-brand-dark/70">{{ o.phone }}</td>
              <td class="px-4 py-3 text-muted">{{ o.provider || '—' }}</td>
              <td class="px-4 py-3 text-right font-heading font-black text-brand">{{ currency(o.amount) }}</td>
              <td class="px-4 py-3"><StatusPill :status="o.status" small /></td>
              <td class="px-4 py-3 text-muted">{{ formatDateTime(o.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile cards -->
      <ul v-if="rows.length" class="space-y-3 lg:hidden">
        <li v-for="o in rows" :key="o.id" class="clay rounded-3xl bg-surface p-4">
          <button type="button" class="flex w-full items-start justify-between gap-2 text-left" @click="openDetail(o.id)">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <p class="font-mono text-[11px] font-bold text-brand">{{ o.reference }}</p>
                <span class="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-extrabold text-brand">{{ o.network || '—' }}</span>
              </div>
              <p class="mt-1 truncate font-heading text-sm font-bold text-brand-dark">{{ o.package }}</p>
              <p class="mt-0.5 text-xs text-muted">{{ o.phone }} · {{ o.provider || '—' }}</p>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-1.5">
              <span class="font-heading text-base font-black text-brand">{{ currency(o.amount) }}</span>
              <StatusPill :status="o.status" small />
            </div>
          </button>
        </li>
      </ul>

      <Pagination :page="meta.current_page" :total-pages="meta.last_page" :total="meta.total" @update:page="page" />
    </template>

    <OrderDetailSheet v-if="activeDetail" :order-id="activeDetail" @close="activeDetail = null" @updated="loadCore" />
  </div>
</template>