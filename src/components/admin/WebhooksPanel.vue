<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '../../services/api'
import { currency, formatDateTime, timeAgo } from '../../utils/format'
import { toast } from '../../services/toast'
import Pagination from './Pagination.vue'

const rows = ref([])
const loading = ref(true)
const loadError = ref('')
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const filters = ref({ source: '', processed: '', event_type: '' })
const expanded = ref(null)

const load = async () => {
  loading.value = true
  loadError.value = ''
  const params = { page: meta.value.current_page, per_page: 20 }
  for (const [k, v] of Object.entries(filters.value)) {
    if (v) params[k] = v
  }
  try {
    const res = await adminApi.getWebhookEvents(params)
    rows.value = res.data || []
    meta.value = res.meta || meta.value
  } catch (err) {
    loadError.value = err?.message || 'Failed to load webhook events.'
    toast(loadError.value, 'error')
  } finally {
    loading.value = false
  }
}

const apply = () => {
  meta.value = { current_page: 1, last_page: 1, total: 0 }
  load()
}
const page = (p) => {
  meta.value.current_page = p
  load()
}

const pretty = (row) => {
  try {
    return JSON.stringify(row.payload, null, 2)
  } catch {
    return String(row.payload || '')
  }
}

const money = (s) => (s && s.amount != null ? currency(s.amount) : '—')

const expand = (row) => (expanded.value = expanded.value === row.id ? null : row.id)

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Webhook events</h1>
        <p class="text-xs font-medium text-muted">Incoming events from Paystack & providers · {{ meta.total }}</p>
      </div>
      <button type="button" class="rounded-xl bg-brand-soft px-3.5 py-2 text-xs font-bold text-brand transition hover:bg-brand/10" @click="load">↻ Reload</button>
    </div>

    <div class="clay flex flex-wrap items-end gap-2.5 rounded-2xl bg-surface p-3.5">
      <label class="min-w-[7rem] flex-1">
        <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Source</span>
        <select v-model="filters.source" class="clay-well w-full rounded-xl bg-bg px-3 py-2 text-xs font-semibold text-brand-dark outline-none">
          <option value="">All</option>
          <option value="paystack">paystack</option>
          <option value="provider">provider</option>
        </select>
      </label>
      <label class="min-w-[7rem] flex-1">
        <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Result</span>
        <select v-model="filters.processed" class="clay-well w-full rounded-xl bg-bg px-3 py-2 text-xs font-semibold text-brand-dark outline-none">
          <option value="">All</option>
          <option value="1">Processed OK</option>
          <option value="0">Errors</option>
        </select>
      </label>
      <label class="min-w-[10rem] flex-[2]">
        <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Event type</span>
        <input v-model="filters.event_type" type="text" placeholder="e.g. charge.success" class="clay-well w-full rounded-xl bg-bg px-3 py-2 text-xs font-medium text-brand-dark outline-none placeholder:text-muted/40" />
      </label>
      <button type="button" class="clay-btn rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-xs font-extrabold text-white transition" @click="apply">Apply</button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand/15 border-t-brand"></div>
    </div>

    <div v-else-if="loadError" class="clay flex items-center justify-center gap-3 rounded-3xl bg-surface py-10 text-center">
      <p class="text-sm font-semibold text-red-600">{{ loadError }}</p>
      <button type="button" class="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100" @click="load">Retry</button>
    </div>

    <template v-else>
      <div v-if="!rows.length" class="clay rounded-3xl bg-surface py-14 text-center">
        <p class="font-heading text-base font-bold text-brand-dark/70">No webhook events</p>
        <p class="mt-1 text-sm text-muted">Events appear here as Paystack and providers call the API.</p>
      </div>

      <!-- Desktop table -->
      <div v-if="rows.length" class="clay hidden overflow-hidden rounded-3xl bg-surface lg:block">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-brand/10 bg-bg/60 text-[10px] font-extrabold tracking-widest text-muted uppercase">
              <th class="px-4 py-3">Source</th>
              <th class="px-4 py-3">Event</th>
              <th class="px-4 py-3">Order · Initiator</th>
              <th class="px-4 py-3">Tx ref</th>
              <th class="px-4 py-3">Amount</th>
              <th class="px-4 py-3">Result</th>
              <th class="px-4 py-3">Received</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.id" class="border-b border-brand/5 transition hover:bg-brand-soft/40">
              <td class="px-4 py-3">
                <span class="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-extrabold text-brand uppercase" :title="r.source === 'paystack' ? 'Payment gateway event' : 'Data provider event'">{{ r.source }}</span>
              </td>
              <td class="px-4 py-3 font-mono font-semibold text-brand-dark">{{ r.event_type || '—' }}</td>
              <td class="px-4 py-3">
                <p class="font-semibold text-brand-dark">{{ r.summary.order_reference || '—' }}</p>
                <p class="text-muted">☎ {{ r.summary.phone || '—' }}</p>
              </td>
              <td class="px-4 py-3 font-mono text-muted">{{ r.summary.reference || '—' }}</td>
              <td class="px-4 py-3">
                <p class="font-heading font-black text-brand">{{ money(r.summary) }}</p>
                <p v-if="r.summary.channel" class="text-[10px] text-muted">{{ r.summary.channel }}</p>
              </td>
              <td class="px-4 py-3">
                <span class="rounded-full px-2 py-0.5 text-[10px] font-extrabold" :class="r.processed_ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'">{{ r.processed_ok ? 'OK' : 'Error' }}</span>
                <p v-if="r.summary.response" class="mt-0.5 text-[10px] text-muted" :title="r.error_message || ''">{{ r.summary.response }}</p>
              </td>
              <td class="px-4 py-3 text-muted">{{ formatDateTime(r.created_at) }} · {{ timeAgo(r.created_at) }}</td>
              <td class="px-4 py-3">
                <button type="button" class="rounded-lg bg-brand-soft px-2.5 py-1 text-[10px] font-bold text-brand transition hover:bg-brand/10" @click="expand(r)">{{ expanded === r.id ? 'Hide' : 'View' }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile cards -->
      <ul v-if="rows.length" class="space-y-3 lg:hidden">
        <li v-for="r in rows" :key="r.id" class="clay rounded-3xl bg-surface p-4">
          <button type="button" class="flex w-full items-start justify-between gap-2 text-left" @click="expand(r)">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-extrabold text-brand uppercase">{{ r.source }}</span>
                <span class="rounded-full px-2 py-0.5 text-[10px] font-extrabold" :class="r.processed_ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'">{{ r.processed_ok ? 'OK' : 'Error' }}</span>
              </div>
              <p class="mt-1 font-mono text-xs font-semibold break-words text-brand-dark">{{ r.event_type || '—' }}</p>
              <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted">
                <span class="font-semibold text-brand-dark">{{ r.summary.order_reference || '—' }}</span>
                <span>☎ {{ r.summary.phone || '—' }}</span>
                <span class="font-heading font-black text-brand">{{ money(r.summary) }}</span>
                <span v-if="r.summary.channel">{{ r.summary.channel }}</span>
              </div>
              <p class="mt-0.5 font-mono text-[10px] text-muted">{{ r.summary.reference || '—' }}</p>
              <p class="mt-0.5 text-[11px] text-muted">{{ timeAgo(r.created_at) }}</p>
            </div>
            <span class="shrink-0 text-[10px] font-bold text-brand">{{ expanded === r.id ? 'Hide' : 'View' }}</span>
          </button>
          <pre v-if="expanded === r.id" class="mt-3 max-h-72 overflow-auto rounded-2xl bg-brand-dark p-3 text-[10px] leading-relaxed text-emerald-100">{{
            pretty(r)
          }}</pre>
        </li>
      </ul>

      <!-- Expanded payload (desktop) -->
      <div v-if="expanded" class="clay hidden rounded-3xl bg-surface p-4 lg:block">
        <pre class="max-h-80 overflow-auto rounded-2xl bg-brand-dark p-4 text-[11px] leading-relaxed text-emerald-100">{{ pretty(rows.find((r) => r.id === expanded)) }}</pre>
      </div>

      <Pagination :page="meta.current_page" :total-pages="meta.last_page" :total="meta.total" @update:page="page" />
    </template>
  </div>
</template>