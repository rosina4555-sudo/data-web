<script setup>
import { ref, computed, onMounted } from 'vue'
import { adminApi } from '../../services/api'
import { currency, formatDateTime, refundMeta } from '../../utils/format'
import { toast } from '../../services/toast'
import Pagination from './Pagination.vue'

const rows = ref([])
const loading = ref(true)
const loadError = ref('')
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const filters = ref({ phone: '', ref: '' })
const selected = ref(new Set())

const modal = ref({ open: false, reason: '', busy: false })

const historyRows = ref([])
const historyMeta = ref({ current_page: 1, last_page: 1, total: 0 })
const historyLoading = ref(false)
const historyError = ref('')
const histFilter = ref('')
const counts = ref({ awaiting: 0, processing: 0, refunded: 0, failed: 0 })

const loadCore = async () => {
  loading.value = true
  loadError.value = ''
  const params = { page: meta.value.current_page, per_page: 15 }
  for (const [k, v] of Object.entries(filters.value)) {
    if (v) params[k] = v
  }
  try {
    const res = await adminApi.getRefunds(params)
    rows.value = res.data || []
    meta.value = res.meta || meta.value
    counts.value = res.counts || counts.value
  } catch (err) {
    loadError.value = err?.message || 'Failed to load refunds.'
    toast(loadError.value, 'error')
  } finally {
    loading.value = false
  }
}

const loadHistory = async () => {
  historyLoading.value = true
  historyError.value = ''
  const params = { page: historyMeta.value.current_page, per_page: 15 }
  if (histFilter.value) params.status = histFilter.value
  try {
    const res = await adminApi.getRefundHistory(params)
    historyRows.value = res.data || []
    historyMeta.value = res.meta || historyMeta.value
    counts.value = res.counts || counts.value
  } catch (err) {
    historyError.value = err?.message || 'Failed to load refund history.'
    toast(historyError.value, 'error')
  } finally {
    historyLoading.value = false
  }
}

const historyPage = (p) => {
  historyMeta.value.current_page = p
  loadHistory()
}

const selectHistoryFilter = (status) => {
  histFilter.value = status
  historyMeta.value = { current_page: 1, last_page: 1, total: 0 }
  loadHistory()
}

const applyFilters = () => {
  meta.value = { current_page: 1, last_page: 1, total: 0 }
  selected.value = new Set()
  loadCore()
}

const resetFilters = () => {
  filters.value = { phone: '', ref: '' }
  applyFilters()
}

const page = (p) => {
  meta.value.current_page = p
  selected.value = new Set()
  loadCore()
}

const allSelected = computed(
  () => rows.value.length > 0 && rows.value.every((r) => selected.value.has(r.id)),
)

const selectedRows = computed(() => rows.value.filter((r) => selected.value.has(r.id)))
const selectedTotal = computed(() => selectedRows.value.reduce((sum, r) => sum + Number(r.amount || 0), 0))

const toggleAll = () => {
  if (allSelected.value) selected.value = new Set()
  else selected.value = new Set(rows.value.map((r) => r.id))
}

const toggleRow = (id) => {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

const openModal = () => {
  if (selected.value.size === 0) return
  modal.value.reason = ''
  modal.value.open = true
}

const refundRow = (o) => {
  if (o.refund?.status === 'processing' || o.refund?.status === 'refunded') return
  if (!selected.value.has(o.id)) {
    const next = new Set(selected.value)
    next.add(o.id)
    selected.value = next
  }
  openModal()
}

const closeModal = () => {
  if (modal.value.busy) return
  modal.value.open = false
}

const confirmRefund = async () => {
  if (!selected.value.size || modal.value.busy) return
  modal.value.busy = true
  try {
    const ids = [...selected.value]
    const res = ids.length === 1
      ? await adminApi.refundOrder(ids[0], modal.value.reason.trim())
      : await adminApi.refundOrdersBulk(ids, modal.value.reason.trim())
    const { refunded = 0, failed = 0 } = res.data || {}
    const failMsgs = (res.data?.results || []).filter((r) => !r.ok).map((r) => r.message)
    toast(
      failed
        ? `Refunded ${refunded} order${refunded === 1 ? '' : 's'}, ${failed} failed.`
        : `Refunded ${refunded} order${refunded === 1 ? '' : 's'}.`,
      failed ? 'warning' : 'success',
    )
    if (failMsgs.length && failMsgs[0]) toast(failMsgs[0], 'error')
    modal.value.open = false
    selected.value = new Set()
    await loadCore()
    loadHistory()
  } catch (err) {
    toast(err?.message || 'Refund failed.', 'error')
  } finally {
    modal.value.busy = false
  }
}

onMounted(() => {
  loadCore()
  loadHistory()
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Refunds</h1>
        <p class="text-xs font-medium text-muted">{{ counts.awaiting }} awaiting refund</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded-xl bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="!selected.size"
          @click="openModal"
        >
          Refund {{ selected.size ? `selected (${selected.size})` : 'selected' }}
        </button>
        <button
          type="button"
          class="rounded-xl bg-brand-soft px-3.5 py-2 text-xs font-bold text-brand transition hover:bg-brand/10"
          @click="loadCore()"
        >
          ↻ Reload
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="clay flex flex-wrap items-end gap-2.5 rounded-2xl bg-surface p-3.5 sm:p-4">
      <label class="min-w-[9rem] flex-1">
        <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Phone</span>
        <input v-model="filters.phone" type="tel" placeholder="024…" class="clay-well w-full rounded-xl bg-bg px-3 py-2 text-xs font-medium text-brand-dark outline-none placeholder:text-muted/40" />
      </label>
      <label class="min-w-[9rem] flex-1">
        <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Reference</span>
        <input v-model="filters.ref" type="text" placeholder="TB-…" class="clay-well w-full rounded-xl bg-bg px-3 py-2 font-mono text-xs font-medium text-brand-dark outline-none placeholder:text-muted/40" />
      </label>
      <div class="flex gap-2">
        <button type="button" class="clay-btn rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-xs font-extrabold text-white transition" @click="applyFilters">Apply</button>
        <button type="button" class="clay-btn-light rounded-xl bg-surface px-3 py-2 text-xs font-bold text-muted transition hover:text-brand" @click="resetFilters">Reset</button>
      </div>
    </div>

    <div v-if="selectedRows.length" class="clay flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-amber-50/70 px-4 py-2.5 text-xs font-semibold text-amber-800">
      <span>{{ selectedRows.length }} selected · {{ currency(selectedTotal) }}</span>
      <button type="button" class="font-bold text-amber-900 underline underline-offset-2 hover:text-amber-950" @click="selected = new Set()">Clear</button>
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
        <p class="font-heading text-base font-bold text-brand-dark/70">No orders awaiting refund</p>
        <p class="mt-1 text-sm text-muted">Orders flagged by the provider or marked for review will appear here.</p>
      </div>

      <!-- Desktop table -->
      <div v-if="rows.length" class="clay hidden overflow-hidden rounded-3xl bg-surface lg:block">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-brand/10 bg-bg/60 text-[10px] font-extrabold tracking-widest text-muted uppercase">
              <th class="px-4 py-3">
                <input type="checkbox" class="h-3.5 w-3.5 accent-[--brand]" :checked="allSelected" @change="toggleAll" />
              </th>
              <th class="px-4 py-3">Reference</th>
              <th class="px-4 py-3">Bundle</th>
              <th class="px-4 py-3">Phone</th>
              <th class="px-4 py-3 text-right">Amount</th>
              <th class="px-4 py-3">Reason</th>
              <th class="px-4 py-3">Refund</th>
              <th class="px-4 py-3">Created</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in rows" :key="o.id" class="border-b border-brand/5 transition hover:bg-brand-soft/40">
              <td class="px-4 py-3">
                <input type="checkbox" class="h-3.5 w-3.5 accent-[--brand]" :checked="selected.has(o.id)" @change="toggleRow(o.id)" />
              </td>
              <td class="px-4 py-3 font-mono font-bold text-brand">{{ o.reference }}</td>
              <td class="px-4 py-3 font-semibold text-brand-dark">{{ o.package }}</td>
              <td class="px-4 py-3 font-medium text-brand-dark/70">{{ o.phone }}</td>
              <td class="px-4 py-3 text-right font-heading font-black text-brand">{{ currency(o.amount) }}</td>
              <td class="px-4 py-3">
                <span
                  class="rounded-full px-2 py-0.5 text-[10px] font-extrabold whitespace-nowrap"
                  :class="o.reason === 'provider_refund' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'"
                >
                  {{ o.reason === 'provider_refund' ? 'Provider refunded' : 'Needs review' }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span v-if="o.refund" class="rounded-full px-2 py-0.5 text-[10px] font-extrabold whitespace-nowrap" :class="refundMeta(o.refund.status).cls">
                  {{ refundMeta(o.refund.status).label }}
                </span>
                <span v-else class="text-muted/60">—</span>
              </td>
              <td class="px-4 py-3 text-muted">{{ formatDateTime(o.created_at) }}</td>
              <td class="px-4 py-3 text-right">
                <button
                  type="button"
                  class="rounded-xl bg-brand-soft px-3 py-1.5 text-[11px] font-extrabold text-brand transition hover:bg-brand/15 disabled:opacity-40"
                  :disabled="o.refund?.status === 'processing' || o.refund?.status === 'refunded'"
                  @click="refundRow(o)"
                >
                  {{ selected.size > 1 ? `Refund selected (${selected.size})` : 'Refund' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile cards -->
      <ul v-if="rows.length" class="space-y-3 lg:hidden">
        <li v-for="o in rows" :key="o.id" class="clay rounded-3xl bg-surface p-4">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <input type="checkbox" class="h-3.5 w-3.5 accent-[--brand]" :checked="selected.has(o.id)" @change="toggleRow(o.id)" />
                <p class="font-mono text-[11px] font-bold text-brand">{{ o.reference }}</p>
              </div>
              <p class="mt-1 truncate font-heading text-sm font-bold text-brand-dark">{{ o.package }}</p>
              <p class="mt-0.5 text-xs text-muted">{{ o.phone }} · {{ o.network || '—' }}</p>
              <span class="mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold" :class="o.reason === 'provider_refund' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'">
                {{ o.reason === 'provider_refund' ? 'Provider refunded' : 'Needs review' }}
              </span>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-1.5">
              <span class="font-heading text-base font-black text-brand">{{ currency(o.amount) }}</span>
              <span v-if="o.refund" class="rounded-full px-2 py-0.5 text-[10px] font-extrabold" :class="refundMeta(o.refund.status).cls">{{ refundMeta(o.refund.status).label }}</span>
              <button
                type="button"
                class="rounded-xl bg-brand-soft px-3 py-1.5 text-[11px] font-extrabold text-brand transition hover:bg-brand/15 disabled:opacity-40"
                :disabled="o.refund?.status === 'processing' || o.refund?.status === 'refunded'"
                @click="refundRow(o)"
              >
                {{ selected.size > 1 ? `Refund selected (${selected.size})` : 'Refund' }}
              </button>
            </div>
          </div>
        </li>
      </ul>

      <Pagination :page="meta.current_page" :total-pages="meta.last_page" :total="meta.total" @update:page="page" />
    </template>

    <!-- Refund history (status tracking) -->
    <section class="mt-8 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-heading text-sm font-bold tracking-tight text-brand-dark">Refund history</h2>
          <p class="text-xs font-medium text-muted">Every refund request and its current status.</p>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="opt in [{ value: '', label: `All (${counts.pending + counts.processing + counts.refunded + counts.failed})` }, { value: 'pending', label: `Pending (${counts.pending})` }, { value: 'processing', label: `Refunding (${counts.processing})` }, { value: 'refunded', label: `Refunded (${counts.refunded})` }, { value: 'failed', label: `Failed (${counts.failed})` }]"
            :key="opt.value"
            type="button"
            class="rounded-xl px-3 py-1.5 text-[11px] font-extrabold transition"
            :class="histFilter === opt.value ? 'bg-gradient-to-r from-brand to-brand-dark text-white' : 'bg-surface text-muted hover:text-brand'"
            @click="selectHistoryFilter(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div v-if="historyLoading" class="flex items-center justify-center py-12">
        <div class="h-7 w-7 animate-spin rounded-full border-4 border-brand/15 border-t-brand"></div>
      </div>

      <div v-else-if="historyError" class="clay flex items-center justify-center gap-3 rounded-3xl bg-surface py-8 text-center">
        <p class="text-sm font-semibold text-red-600">{{ historyError }}</p>
        <button type="button" class="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100" @click="loadHistory">Retry</button>
      </div>

      <template v-else>
        <div v-if="!historyRows.length" class="clay rounded-3xl bg-surface py-10 text-center">
          <p class="font-heading text-sm font-bold text-brand-dark/70">No refunds {{ histFilter ? 'with this status' : 'yet' }}</p>
          <p class="mt-1 text-xs text-muted">Refunds you process will show up here.</p>
        </div>

        <div v-if="historyRows.length" class="clay hidden overflow-hidden rounded-3xl bg-surface lg:block">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-brand/10 bg-bg/60 text-[10px] font-extrabold tracking-widest text-muted uppercase">
                <th class="px-4 py-3">Order</th>
                <th class="px-4 py-3">Bundle</th>
                <th class="px-4 py-3">Phone</th>
                <th class="px-4 py-3 text-right">Amount</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3">Refund ref</th>
                <th class="px-4 py-3">Initiated</th>
                <th class="px-4 py-3">Resolved</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in historyRows" :key="r.id" class="border-b border-brand/5 transition hover:bg-brand-soft/40">
                <td class="px-4 py-3">
                  <p class="font-mono font-bold text-brand">{{ r.order_ref }}</p>
                  <p v-if="r.reason" class="text-[10px] text-muted">{{ r.reason }}</p>
                </td>
                <td class="px-4 py-3 font-semibold text-brand-dark">{{ r.package }}{{ r.network ? ` · ${r.network}` : '' }}</td>
                <td class="px-4 py-3 font-medium text-brand-dark/70">{{ r.phone }}</td>
                <td class="px-4 py-3 text-right font-heading font-black text-brand">{{ currency(r.amount) }}</td>
                <td class="px-4 py-3">
                  <span class="rounded-full px-2 py-0.5 text-[10px] font-extrabold whitespace-nowrap" :class="refundMeta(r.status).cls">
                    {{ refundMeta(r.status).label }}
                  </span>
                </td>
                <td class="px-4 py-3 font-mono text-[10px] text-brand-dark/60">
                  <p v-if="r.paystack_refund_ref">{{ r.paystack_refund_ref }}</p>
                  <p v-else class="text-muted/60">—</p>
                </td>
                <td class="px-4 py-3 text-muted">{{ formatDateTime(r.initiated_at || r.created_at) }}</td>
                <td class="px-4 py-3 text-muted">{{ r.refunded_at ? formatDateTime(r.refunded_at) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ul v-if="historyRows.length" class="space-y-3 lg:hidden">
          <li v-for="r in historyRows" :key="r.id" class="clay rounded-3xl bg-surface p-4">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <p class="font-mono text-[11px] font-bold text-brand">{{ r.order_ref }}</p>
                  <span class="rounded-full px-2 py-0.5 text-[10px] font-extrabold" :class="refundMeta(r.status).cls">{{ refundMeta(r.status).label }}</span>
                </div>
                <p class="mt-1 truncate font-heading text-sm font-bold text-brand-dark">{{ r.package }}</p>
                <p class="mt-0.5 text-xs text-muted">{{ r.phone }} · {{ currency(r.amount) }}</p>
                <p v-if="r.paystack_refund_ref" class="mt-1 truncate font-mono text-[10px] text-brand-dark/60">{{ r.paystack_refund_ref }}</p>
                <p class="mt-1 text-[10px] text-muted">{{ formatDateTime(r.initiated_at || r.created_at) }}</p>
              </div>
            </div>
          </li>
        </ul>

        <Pagination :page="historyMeta.current_page" :total-pages="historyMeta.last_page" :total="historyMeta.total" @update:page="historyPage" />
      </template>
    </section>

    <!-- Confirm modal -->
    <div v-if="modal.open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="closeModal">
      <div class="clay w-full max-w-md rounded-3xl bg-surface p-5 shadow-2xl">
        <h2 class="font-heading text-base font-bold text-brand-dark">Refund {{ selectedRows.length }} order{{ selectedRows.length === 1 ? '' : 's' }}</h2>
        <p class="mt-1 text-xs text-muted">
          Total {{ currency(selectedTotal) }} will be returned to the customers via Paystack.
        </p>
        <ul class="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs">
          <li v-for="o in selectedRows" :key="o.id" class="flex items-center justify-between rounded-lg bg-bg/60 px-3 py-1.5">
            <span class="font-mono font-bold text-brand">{{ o.reference }}</span>
            <span class="font-semibold text-brand-dark">{{ currency(o.amount) }}</span>
          </li>
        </ul>
        <label class="mt-4 block">
          <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Reason (optional)</span>
          <textarea v-model="modal.reason" rows="2" maxlength="500" placeholder="Why are you refunding these orders?" class="clay-well w-full rounded-xl bg-bg px-3 py-2 text-xs font-medium text-brand-dark outline-none placeholder:text-muted/40"></textarea>
        </label>
        <div class="mt-5 flex items-center justify-end gap-2">
          <button type="button" class="clay-btn-light rounded-xl bg-surface px-4 py-2 text-xs font-bold text-muted transition hover:text-brand" :disabled="modal.busy" @click="closeModal">Cancel</button>
          <button
            type="button"
            class="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-xs font-extrabold text-white transition hover:opacity-90 disabled:opacity-50"
            :disabled="modal.busy"
            @click="confirmRefund"
          >
            {{ modal.busy ? 'Refunding…' : 'Confirm refund' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>