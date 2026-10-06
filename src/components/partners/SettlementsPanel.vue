<script setup>
/**
 * Partner refund settlements.
 *
 * A settlement is a refund we have decided on but not yet handed back. The cron
 * drains the queue every five minutes, so most rows here should be transient.
 *
 * Retry is immediate, not "ask the cron nicely": it resets the row and pays it in
 * the same call, holding the same locks in the same order as the cron so the two
 * cannot both pay. The honest outcome is often 202 — re-armed, cron still owns
 * the next attempt — or 409 with the row attached. Both are handled by reloading
 * and letting the table tell the operator what actually happened, rather than
 * showing a bare error for an action that partially succeeded.
 */
import { ref, computed, onMounted } from 'vue'
import { partnerApi } from '../../services/partnerApi'
import { toast } from '../../services/toast'
import { money, settlementMeta, isRetryable } from '../../utils/partners'
import { formatDateTime } from '../../utils/format'
import Pagination from '../admin/Pagination.vue'
import LoadError from '../LoadError.vue'

const tenants = ref([])
const tenantId = ref(null)
const rows = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const page = ref(1)
const status = ref('')
const loading = ref(false)
const error = ref('')
const retryingId = ref(null)

// Two loads (picker, rows); the picker failing must not read as "no partners".
const tenantsError = ref('')
const loadError = computed(() => tenantsError.value || error.value)

const loadTenants = async () => {
  try {
    const res = await partnerApi.getTenants({ per_page: 100 })
    tenants.value = res.data
    tenantsError.value = ''
  } catch (err) {
    tenantsError.value = err?.message || 'Could not load partners.'
  }
}

const load = async () => {
  if (!tenantId.value) {
    rows.value = []
    return
  }
  loading.value = true
  error.value = ''
  try {
    const res = await partnerApi.getSettlements(tenantId.value, {
      page: page.value,
      per_page: 15,
      status: status.value || undefined,
    })
    rows.value = res.data
    meta.value = res.meta
  } catch (err) {
    error.value = err?.message || 'Could not load settlements.'
  } finally {
    loading.value = false
  }
}

const reload = async () => {
  await loadTenants()
  if (!tenantId.value && tenants.value.length) tenantId.value = tenants.value[0].id
  await load()
}

onMounted(reload)

const retry = async (row) => {
  if (retryingId.value !== null) return
  retryingId.value = row.id
  try {
    await partnerApi.retrySettlement(tenantId.value, row.id)
    toast('Payment retried', 'success')
  } catch (err) {
    // 409 is the documented "declined" answer and carries a reason. The reload
    // below surfaces last_error in the table; the toast just says it did not pay.
    toast(err?.message || 'Could not retry that payment.', 'error')
  } finally {
    retryingId.value = null
    // Reload either way: the row's state changed regardless of the status code.
    load()
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="clay flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-surface p-4 sm:p-5">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Settlements</h1>
        <p class="mt-0.5 text-xs text-muted">
          Refunds owed to partners. The cron clears these every five minutes; retry pays one
          immediately.
        </p>
      </div>
      <div class="flex items-end gap-2">
        <label class="block min-w-52">
          <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Partner</span>
          <select
            v-model="tenantId"
            class="clay-well w-full rounded-xl bg-bg px-3 py-2 text-xs font-semibold text-brand-dark outline-none"
            @change="((page = 1), load())"
          >
            <option :value="null" disabled>Select a partner…</option>
            <option v-for="t in tenants" :key="t.id" :value="t.id">{{ t.name }} ({{ t.slug }})</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Status</span>
          <select
            v-model="status"
            class="clay-well rounded-xl bg-bg px-3 py-2 text-xs font-semibold text-brand-dark outline-none"
            @change="((page = 1), load())"
          >
            <option value="">All</option>
            <option value="pending">Queued</option>
            <option value="applied">Paid</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
          </select>
        </label>
      </div>
    </div>

    <LoadError :error="loadError" :busy="loading" @retry="reload" />

    <div v-if="tenantId" class="clay overflow-hidden rounded-2xl bg-surface">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-brand/10 bg-bg/60 text-[10px] font-extrabold tracking-widest text-muted uppercase">
              <th class="px-4 py-3">Order</th>
              <th class="px-4 py-3">Kind</th>
              <th class="px-4 py-3 text-right">Amount</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3 text-right">Attempts</th>
              <th class="px-4 py-3">Last error</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id" class="border-b border-brand/5 last:border-0">
              <td class="px-4 py-3 font-mono text-[11px] font-semibold text-brand-dark">
                {{ row.order_reference || `#${row.order_id}` }}
              </td>
              <td class="px-4 py-3 text-muted">{{ row.kind }}</td>
              <td class="px-4 py-3 text-right font-bold text-brand-dark">{{ money(row.amount_minor) }}</td>
              <td class="px-4 py-3">
                <span class="rounded-full px-2 py-0.5 text-[10px] font-extrabold" :class="settlementMeta(row.status).cls">
                  {{ settlementMeta(row.status).label }}
                </span>
              </td>
              <td class="px-4 py-3 text-right text-[11px] font-semibold" :class="row.attempts >= 5 ? 'text-amber-600' : 'text-muted'">
                {{ row.attempts }}
              </td>
              <td class="max-w-64 px-4 py-3">
                <span v-if="row.last_error" class="line-clamp-2 text-[11px] text-red-600">{{ row.last_error }}</span>
                <span v-else class="text-[11px] text-muted">—</span>
              </td>
              <td class="px-4 py-3 text-right">
                <button
                  v-if="isRetryable(row)"
                  type="button"
                  :disabled="retryingId !== null"
                  class="rounded-lg bg-brand/10 px-2.5 py-1 text-[11px] font-bold text-brand transition hover:bg-brand/20 disabled:opacity-50"
                  @click="retry(row)"
                >
                  {{ retryingId === row.id ? 'Retrying…' : 'Retry now' }}
                </button>
                <span v-else-if="row.applied_at" class="text-[10px] text-muted">
                  {{ formatDateTime(row.applied_at) }}
                </span>
              </td>
            </tr>
                        <tr v-if="loading">
              <td colspan="7" class="px-4 py-8 text-center text-xs text-muted">Loading…</td>
            </tr>
<tr v-if="!loading && !rows.length">
              <td colspan="7" class="px-4 py-8 text-center text-xs text-muted">
                Nothing waiting. Queued rows appear here until they are paid.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="px-4 pb-3">
        <Pagination v-model:page="page" :total-pages="meta.last_page" :total="meta.total" />
      </div>
    </div>

    <p v-else-if="!tenantsError && !tenants.length" class="rounded-2xl bg-surface py-10 text-center text-xs text-muted">
      Create a partner first.
    </p>
  </div>
</template>
