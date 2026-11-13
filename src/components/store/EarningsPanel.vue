<script setup>
import { ref, onMounted } from 'vue'
import { storeApi } from '../../services/storeApi'
import { currency, formatDateTime } from '../../utils/format'
import { toast } from '../../services/toast'
import Pagination from '../admin/Pagination.vue'

const TYPE_LABEL = {
  order_profit: 'Order profit',
  order_profit_reversal: 'Refund reversal',
  withdrawal_hold: 'Withdrawal',
  withdrawal_release: 'Withdrawal returned',
  admin_adjustment: 'Adjustment',
}

const summary = ref(null)
const rows = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const loading = ref(true)
const loadError = ref('')

const load = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const [money, entries] = await Promise.all([
      storeApi.earningsSummary(),
      storeApi.earnings({ page: meta.value.current_page, per_page: 20 }),
    ])
    summary.value = money.data
    rows.value = entries.data || []
    meta.value = entries.meta || meta.value
  } catch (err) {
    loadError.value = err?.message || 'Could not load your earnings.'
    toast(loadError.value, 'error')
  } finally {
    loading.value = false
  }
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
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Earnings</h1>
        <p class="text-xs font-medium text-muted">Every credit and debit on your shop wallet, in order.</p>
      </div>
      <button type="button" class="rounded-xl bg-brand-soft px-3.5 py-2 text-xs font-bold text-brand transition hover:bg-brand/10" @click="load">
        ↻ Reload
      </button>
    </div>

    <div class="grid grid-cols-3 gap-3">
      <div class="clay rounded-2xl bg-surface p-4">
        <p class="text-[10px] font-bold tracking-widest text-muted uppercase">Available</p>
        <p class="mt-1 font-heading text-xl font-black text-brand sm:text-2xl">{{ currency((summary?.available_minor || 0) / 100) }}</p>
      </div>
      <div class="clay rounded-2xl bg-surface p-4">
        <p class="text-[10px] font-bold tracking-widest text-muted uppercase">Earned</p>
        <p class="mt-1 font-heading text-xl font-black text-brand-dark sm:text-2xl">{{ currency((summary?.lifetime_credit_minor || 0) / 100) }}</p>
      </div>
      <div class="clay rounded-2xl bg-surface p-4">
        <p class="text-[10px] font-bold tracking-widest text-muted uppercase">Withdrawn</p>
        <p class="mt-1 font-heading text-xl font-black text-brand-dark sm:text-2xl">{{ currency((summary?.lifetime_debit_minor || 0) / 100) }}</p>
      </div>
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
        <p class="font-heading text-base font-bold text-brand-dark/70">Nothing here yet</p>
        <p class="mt-1 text-sm text-muted">Profit appears as soon as a bundle is delivered.</p>
      </div>

      <div v-else class="clay overflow-hidden rounded-3xl bg-surface">
        <ul class="divide-y divide-brand/5">
          <li v-for="entry in rows" :key="entry.id" class="flex items-center justify-between gap-3 px-4 py-3">
            <div class="min-w-0">
              <p class="text-xs font-bold text-brand-dark">{{ TYPE_LABEL[entry.type] || entry.type }}</p>
              <p class="mt-0.5 truncate text-[11px] text-muted">
                {{ entry.description || '—' }}
                <span class="text-muted/60">· {{ formatDateTime(entry.created_at) }}</span>
              </p>
            </div>
            <div class="shrink-0 text-right">
              <p class="font-heading text-sm font-black" :class="entry.direction === 'credit' ? 'text-emerald-600' : 'text-brand-dark'">
                {{ entry.direction === 'credit' ? '+' : '−' }}{{ currency(entry.amount_minor / 100) }}
              </p>
              <p class="text-[10px] font-semibold text-muted">Balance {{ currency(entry.balance_after_minor / 100) }}</p>
            </div>
          </li>
        </ul>
      </div>

      <Pagination :page="meta.current_page" :total-pages="meta.last_page" :total="meta.total" @update:page="goPage" />
    </template>
  </div>
</template>
