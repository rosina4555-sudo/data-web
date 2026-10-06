<script setup>
/**
 * Wallet balances and manual adjustments.
 *
 * Three things this screen refuses to let happen quietly:
 *
 *  - An adjustment without a reason. The backend rejects it too; the form does
 *    not offer a default reason for an operator to accept without thinking.
 *  - The same adjustment twice. The Idempotency-Key is minted when the form opens
 *    and reused for every submit of that form, so a double-click or a retry after
 *    a timeout returns the first entry instead of moving money twice. It is only
 *    regenerated once an adjustment actually succeeds.
 *  - A hidden drift. `ledger_healthy` is shown as a warning rather than folded
 *    into a balance figure, because a balance that disagrees with the ledger is
 *    the single most expensive thing to miss.
 */
import { ref, onMounted } from 'vue'
import { partnerApi } from '../../services/partnerApi'
import { toast } from '../../services/toast'
import { money, newIdempotencyKey } from '../../utils/partners'
import { formatDateTime } from '../../utils/format'
import Pagination from '../admin/Pagination.vue'

const ENTRY_META = {
  topup: { label: 'Top-up', cls: 'bg-emerald-50 text-emerald-700' },
  order_debit: { label: 'Order', cls: 'bg-slate-100 text-slate-600' },
  refund_credit: { label: 'Refund', cls: 'bg-sky-50 text-sky-700' },
  settlement_credit: { label: 'Settlement', cls: 'bg-violet-50 text-violet-700' },
  manual_credit: { label: 'Manual +', cls: 'bg-emerald-50 text-emerald-700' },
  manual_debit: { label: 'Manual −', cls: 'bg-red-50 text-red-600' },
  admin_debit: { label: 'Admin −', cls: 'bg-red-50 text-red-600' },
}

const entryMeta = (type) => ENTRY_META[type] || { label: type || '—', cls: 'bg-slate-100 text-slate-500' }

const tenants = ref([])
const tenantId = ref(null)
const wallet = ref(null)
const entries = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const page = ref(1)
const direction = ref('')
const loading = ref(false)
const error = ref('')

const showAdjust = ref(false)
const adjusting = ref(false)
const form = ref({ direction: 'credit', amount: '', reason: '' })
const idempotencyKey = ref(newIdempotencyKey())

const loadTenants = async () => {
  try {
    const res = await partnerApi.getTenants({ per_page: 100 })
    tenants.value = res.data
  } catch {
    /* picker stays empty */
  }
}

const loadWallet = async () => {
  if (!tenantId.value) {
    wallet.value = null
    entries.value = []
    return
  }
  loading.value = true
  error.value = ''
  try {
    const [w, e] = await Promise.all([
      partnerApi.getWallet(tenantId.value),
      partnerApi.getWalletEntries(tenantId.value, {
        page: page.value,
        per_page: 15,
        direction: direction.value || undefined,
      }),
    ])
    wallet.value = w.data
    entries.value = e.data
    meta.value = e.meta
  } catch (err) {
    error.value = err?.message || 'Could not load this wallet.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadTenants()
  if (tenants.value.length) tenantId.value = tenants.value[0].id
  loadWallet()
})

const openAdjust = () => {
  form.value = { direction: 'credit', amount: '', reason: '' }
  idempotencyKey.value = newIdempotencyKey()
  showAdjust.value = true
}

/** Operator-friendly: they type cedis, we send pesewa. */
const amountMinor = () => {
  const n = Number(String(form.value.amount).trim())
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100)
}

const submitAdjust = async () => {
  if (adjusting.value) return
  const minor = amountMinor()
  if (minor === null) {
    toast('Enter an amount greater than zero', 'error')
    return
  }
  if (!form.value.reason.trim()) {
    toast('A reason is required — it is what makes this entry explainable later', 'error')
    return
  }

  adjusting.value = true
  try {
    await partnerApi.adjustWallet(
      tenantId.value,
      {
        direction: form.value.direction,
        amount_minor: minor,
        reason: form.value.reason.trim(),
      },
      idempotencyKey.value,
    )
    toast('Wallet adjusted', 'success')
    showAdjust.value = false
    // Fresh key for the next adjustment: this one landed, so the next one is a
    // genuinely new movement and must not be deduplicated against it.
    idempotencyKey.value = newIdempotencyKey()
    loadWallet()
  } catch (err) {
    toast(err?.message || 'Could not adjust this wallet.', 'error')
  } finally {
    adjusting.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="clay flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-surface p-4 sm:p-5">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Wallets</h1>
        <p class="mt-0.5 text-xs text-muted">
          What we hold for each partner. Every movement, including anything you do here, is in
          the append-only ledger.
        </p>
      </div>
      <div class="flex items-end gap-2">
        <label class="block min-w-52">
          <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Partner</span>
          <select
            v-model="tenantId"
            class="clay-well w-full rounded-xl bg-bg px-3 py-2 text-xs font-semibold text-brand-dark outline-none"
            @change="((page = 1), loadWallet())"
          >
            <option :value="null" disabled>Select a partner…</option>
            <option v-for="t in tenants" :key="t.id" :value="t.id">{{ t.name }} ({{ t.slug }})</option>
          </select>
        </label>
        <button
          v-if="wallet"
          type="button"
          class="clay-btn rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-xs font-bold text-white"
          @click="openAdjust"
        >
          Adjust
        </button>
      </div>
    </div>

    <p v-if="error" class="rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{{ error }}</p>

    <template v-if="wallet">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div class="clay rounded-2xl bg-surface p-4 sm:p-5">
          <p class="text-[11px] font-bold tracking-widest text-muted uppercase">Balance</p>
          <p class="mt-1 font-heading text-2xl font-black tracking-tight text-brand">
            {{ money(wallet.balance_minor) }}
          </p>
        </div>
        <div class="clay rounded-2xl bg-surface p-4 sm:p-5">
          <p class="text-[11px] font-bold tracking-widest text-muted uppercase">Available</p>
          <p class="mt-1 font-heading text-2xl font-black tracking-tight text-brand-dark">
            {{ money(wallet.available_minor) }}
          </p>
          <p class="mt-1 text-[10px] text-muted">Balance less the {{ money(wallet.min_balance_minor) }} floor.</p>
        </div>
        <div class="clay rounded-2xl bg-surface p-4 sm:p-5">
          <p class="text-[11px] font-bold tracking-widest text-muted uppercase">Topped up</p>
          <p class="mt-1 font-heading text-2xl font-black tracking-tight text-emerald-600">
            {{ money(wallet.totals?.topup_minor ?? 0) }}
          </p>
          <p class="mt-1 text-[10px] text-muted">Refunded {{ money(wallet.totals?.refund_minor ?? 0) }} · debited {{ money(wallet.totals?.debit_minor ?? 0) }}</p>
        </div>
        <div class="clay rounded-2xl bg-surface p-4 sm:p-5">
          <p class="text-[11px] font-bold tracking-widest text-muted uppercase">Ledger</p>
          <p
            class="mt-1 font-heading text-2xl font-black tracking-tight"
            :class="wallet.ledger_healthy ? 'text-emerald-600' : 'text-red-600'"
          >
            {{ wallet.ledger_healthy ? 'Balanced' : 'Drift' }}
          </p>
          <p class="mt-1 text-[10px]" :class="wallet.ledger_healthy ? 'text-muted' : 'font-semibold text-red-600'">
            {{ wallet.ledger_healthy ? 'Every entry is accounted for.' : `${money(wallet.drift_minor)} unaccounted — investigate before adjusting.` }}
          </p>
        </div>
      </div>

      <div class="clay overflow-hidden rounded-2xl bg-surface">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-brand/10 px-4 py-3">
          <h2 class="font-heading text-sm font-bold tracking-tight text-brand-dark">Ledger</h2>
          <select
            v-model="direction"
            class="clay-well rounded-lg bg-bg px-2.5 py-1.5 text-[11px] font-semibold text-brand-dark outline-none"
            @change="((page = 1), loadWallet())"
          >
            <option value="">All movement</option>
            <option value="credit">Credits</option>
            <option value="debit">Debits</option>
          </select>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-brand/10 bg-bg/60 text-[10px] font-extrabold tracking-widest text-muted uppercase">
                <th class="px-4 py-3">Type</th>
                <th class="px-4 py-3 text-right">Amount</th>
                <th class="px-4 py-3 text-right">Balance after</th>
                <th class="px-4 py-3">Reason</th>
                <th class="px-4 py-3">Reference</th>
                <th class="px-4 py-3 text-right">When</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in entries" :key="e.id" class="border-b border-brand/5 last:border-0">
                <td class="px-4 py-3">
                  <span class="rounded-full px-2 py-0.5 text-[10px] font-extrabold" :class="entryMeta(e.type).cls">
                    {{ entryMeta(e.type).label }}
                  </span>
                </td>
                <td class="px-4 py-3 text-right font-bold" :class="e.direction === 'credit' ? 'text-emerald-600' : 'text-red-600'">
                  {{ e.direction === 'credit' ? '+' : '−' }}{{ money(e.amount_minor) }}
                </td>
                <td class="px-4 py-3 text-right font-semibold text-brand-dark">{{ money(e.balance_after_minor) }}</td>
                <td class="max-w-52 px-4 py-3 text-[11px] text-ink/70">
                  <span class="line-clamp-2">{{ e.reason || '—' }}</span>
                </td>
                <td class="px-4 py-3 font-mono text-[10px] text-muted">{{ e.reference || '—' }}</td>
                <td class="px-4 py-3 text-right text-[11px] text-muted">{{ formatDateTime(e.created_at) }}</td>
              </tr>
              <tr v-if="!loading && !entries.length">
                <td colspan="6" class="px-4 py-8 text-center text-xs text-muted">No movements yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="px-4 pb-3">
          <Pagination v-model:page="page" :total-pages="meta.last_page" :total="meta.total" />
        </div>
      </div>
    </template>

    <p v-else-if="!tenants.length" class="rounded-2xl bg-surface py-10 text-center text-xs text-muted">
      Create a partner first.
    </p>

    <!-- Manual adjustment -->
    <Teleport to="body">
      <div
        v-if="showAdjust"
        class="fixed inset-0 z-50 flex items-end justify-center bg-brand-dark/45 backdrop-blur-sm sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        @click.self="showAdjust = false"
      >
        <div class="clay flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface sm:max-w-md sm:rounded-3xl">
          <div class="flex shrink-0 items-center justify-between border-b border-brand/10 px-5 py-4">
            <p class="font-heading text-sm font-bold text-brand-dark">Adjust wallet</p>
            <button type="button" class="text-muted transition hover:text-brand" aria-label="Close" @click="showAdjust = false">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <form class="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4" @submit.prevent="submitAdjust">
            <div>
              <p class="mb-1 text-xs font-bold text-brand-dark/70">Direction</p>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="d in [{ id: 'credit', label: 'Credit' }, { id: 'debit', label: 'Debit' }]"
                  :key="d.id"
                  type="button"
                  class="rounded-xl px-3 py-2.5 text-xs font-bold transition"
                  :class="form.direction === d.id
                    ? (d.id === 'credit' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white')
                    : 'bg-bg text-ink/60 hover:bg-brand/5'"
                  @click="form.direction = d.id"
                >
                  {{ d.label }}
                </button>
              </div>
            </div>

            <label class="block">
              <span class="mb-1 block text-xs font-bold text-brand-dark/70">Amount (cedis)</span>
              <input
                v-model="form.amount"
                type="number"
                step="0.01"
                min="0"
                required
                class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 text-sm font-semibold outline-none"
                placeholder="500.00"
              />
              <span v-if="amountMinor()" class="mt-1 block text-[10px] text-muted">
                Sends {{ amountMinor() }} pesewa. Balance is currently {{ money(wallet?.balance_minor ?? 0) }}.
              </span>
            </label>

            <label class="block">
              <span class="mb-1 block text-xs font-bold text-brand-dark/70">Reason</span>
              <textarea
                v-model="form.reason"
                rows="2"
                required
                maxlength="255"
                class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 text-sm outline-none"
                placeholder="Goodwill credit for order #PD-1042 short-delivered"
              ></textarea>
              <span class="mt-1 block text-[10px] text-muted">
                Required, and stored on the ledger entry. "Adjustment" on its own is not a reason.
              </span>
            </label>

            <p class="rounded-xl bg-bg px-3 py-2.5 font-mono text-[10px] break-all text-muted">
              idempotency: {{ idempotencyKey }}
            </p>
            <p class="text-[10px] text-muted">
              Submitting twice with this form returns the same entry. A new key is minted only
              after an adjustment succeeds.
            </p>
          </form>

          <div class="flex shrink-0 gap-2 border-t border-brand/10 px-5 py-4">
            <button type="button" class="clay-btn-light flex-1 rounded-xl bg-surface px-4 py-2.5 text-xs font-bold text-brand-dark" @click="showAdjust = false">
              Cancel
            </button>
            <button
              type="button"
              :disabled="adjusting"
              class="clay-btn flex-1 rounded-xl px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
              :class="form.direction === 'credit' ? 'bg-gradient-to-r from-emerald-600 to-emerald-700' : 'bg-gradient-to-r from-red-600 to-red-700'"
              @click="submitAdjust"
            >
              {{ adjusting ? 'Applying…' : form.direction === 'credit' ? 'Credit' : 'Debit' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
