<script setup>
import { ref, onMounted } from 'vue'
import { storeApi } from '../../services/storeApi'
import { currency, formatDateTime } from '../../utils/format'
import { toast } from '../../services/toast'
import StatusPill from '../StatusPill.vue'
import Pagination from '../admin/Pagination.vue'

const STATUSES = ['PENDING_PAYMENT', 'PAID', 'SUBMITTED', 'SUCCESS', 'FAILED', 'SUPERVISED', 'REFUNDED', 'EXPIRED']

const rows = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const status = ref('')
const loading = ref(true)
const loadError = ref('')

const load = async () => {
  loading.value = true
  loadError.value = ''
  const params = { page: meta.value.current_page, per_page: 15 }
  if (status.value) params.status = status.value

  try {
    const res = await storeApi.orders(params)
    rows.value = res.data || []
    meta.value = res.meta || meta.value
  } catch (err) {
    loadError.value = err?.message || 'Could not load your orders.'
    toast(loadError.value, 'error')
  } finally {
    loading.value = false
  }
}

const applyFilter = () => {
  meta.value = { ...meta.value, current_page: 1 }
  load()
}

const goPage = (page) => {
  meta.value = { ...meta.value, current_page: page }
  load()
}

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Orders</h1>
        <p class="text-xs font-medium text-muted">{{ meta.total }} sale{{ meta.total === 1 ? '' : 's' }} through your shop</p>
      </div>
      <button type="button" class="rounded-xl bg-brand-soft px-3.5 py-2 text-xs font-bold text-brand transition hover:bg-brand/10" @click="load">
        ↻ Reload
      </button>
    </div>

    <div class="clay flex flex-wrap items-end gap-2.5 rounded-2xl bg-surface p-3.5 sm:p-4">
      <label class="min-w-[10rem] flex-1">
        <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Status</span>
        <select v-model="status" class="clay-well w-full rounded-xl bg-bg px-3 py-2 text-xs font-semibold text-brand-dark outline-none" @change="applyFilter">
          <option value="">All</option>
          <option v-for="s in STATUSES" :key="s" :value="s">{{ s }}</option>
        </select>
      </label>
      <p class="pb-2 text-[11px] text-muted">Customers pay the price you set; your profit is credited when the bundle is delivered.</p>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand/15 border-t-brand"></div>
    </div>

    <div v-else-if="loadError" class="clay rounded-3xl bg-surface py-10 text-center">
      <p class="text-sm font-semibold text-red-600">{{ loadError }}</p>
      <button type="button" class="mt-3 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600" @click="load">Retry</button>
    </div>

    <template v-else>
      <div v-if="!rows.length" class="clay rounded-3xl bg-surface py-14 text-center">
        <p class="font-heading text-base font-bold text-brand-dark/70">No orders yet</p>
        <p class="mt-1 text-sm text-muted">Share your shop link and sales will appear here.</p>
      </div>

      <div v-if="rows.length" class="clay hidden overflow-hidden rounded-3xl bg-surface lg:block">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-brand/10 bg-bg/60 text-[10px] font-extrabold tracking-widest text-muted uppercase">
              <th class="px-4 py-3">Reference</th>
              <th class="px-4 py-3">Bundle</th>
              <th class="px-4 py-3">Customer</th>
              <th class="px-4 py-3 text-right">Customer paid</th>
              <th class="px-4 py-3 text-right">You keep</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in rows" :key="o.reference" class="border-b border-brand/5 hover:bg-brand-soft/40">
              <td class="px-4 py-3 font-mono font-bold text-brand">{{ o.reference }}</td>
              <td class="px-4 py-3">
                <span class="font-semibold text-brand-dark">{{ o.package }}</span>
                <span class="ml-1.5 rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-extrabold text-brand">{{ o.network || '—' }}</span>
              </td>
              <td class="px-4 py-3 font-medium text-brand-dark/70">{{ o.phone }}</td>
              <td class="px-4 py-3 text-right font-heading font-black text-brand">{{ currency(o.amount) }}</td>
              <td class="px-4 py-3 text-right font-bold" :class="o.profit_minor > 0 ? 'text-emerald-600' : 'text-muted'">
                {{ currency(o.profit_minor / 100) }}
              </td>
              <td class="px-4 py-3"><StatusPill :status="o.status" small /></td>
              <td class="px-4 py-3 text-muted">{{ formatDateTime(o.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <ul v-if="rows.length" class="space-y-3 lg:hidden">
        <li v-for="o in rows" :key="o.reference" class="clay rounded-3xl bg-surface p-4">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-mono text-[11px] font-bold text-brand">{{ o.reference }}</p>
              <p class="mt-1 truncate font-heading text-sm font-bold text-brand-dark">{{ o.package }}</p>
              <p class="mt-0.5 text-xs text-muted">{{ o.phone }} · {{ formatDateTime(o.created_at) }}</p>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-1">
              <span class="font-heading text-base font-black text-brand">{{ currency(o.amount) }}</span>
              <StatusPill :status="o.status" small />
            </div>
          </div>
          <p class="mt-2 border-t border-brand/5 pt-2 text-[11px] font-semibold text-muted">
            You keep <span class="font-bold text-emerald-600">{{ currency(o.profit_minor / 100) }}</span>
          </p>
        </li>
      </ul>

      <Pagination :page="meta.current_page" :total-pages="meta.last_page" :total="meta.total" @update:page="goPage" />
    </template>
  </div>
</template>
