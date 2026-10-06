<script setup>
/**
 * Wallet — balance, top-ups and the ledger underneath both.
 *
 * Three figures are shown separately on purpose. `balance` is what the account
 * holds, `min_balance` is the reserve the platform will not spend, and
 * `available` is the only one a purchase can actually use. Collapsing them into
 * one number is what makes "you have money but the order was refused" look
 * like a bug rather than a rule.
 *
 * Top-ups leave for Paystack and come back; nothing here claims credit before
 * the webhook says it landed.
 */
import { ref, onMounted, computed, watch } from 'vue'
import { tenantApi } from '../../services/tenantApi'
import { toast } from '../../services/toast'
import { money, newIdempotencyKey } from '../../utils/partners'
import { currency, formatDateTime } from '../../utils/format'
import LoadError from '../LoadError.vue'
import Pagination from '../admin/Pagination.vue'

const ENTRY_META = {
  topup: { label: 'Top-up', cls: 'bg-emerald-50 text-emerald-700' },
  order_debit: { label: 'Order', cls: 'bg-slate-100 text-slate-600' },
  order_refund: { label: 'Refund', cls: 'bg-sky-50 text-sky-700' },
  admin_adjustment: { label: 'Adjustment', cls: 'bg-violet-50 text-violet-700' },
  reversal: { label: 'Reversal', cls: 'bg-amber-50 text-amber-700' },
}

const entryMeta = (type) => ENTRY_META[type] || { label: type || '—', cls: 'bg-slate-100 text-slate-500' }

const wallet = ref(null)
const entries = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const page = ref(1)

const loading = ref(false)
const error = ref('')

const form = ref({ amount: '', email: '' })
const starting = ref(false)
const idempotencyKey = ref(newIdempotencyKey())

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const [w, e] = await Promise.all([
      tenantApi.getWallet(),
      tenantApi.getEntries({ page: page.value, per_page: 15 }),
    ])
    wallet.value = w.data
    entries.value = e.data
    meta.value = e.meta
  } catch (err) {
    error.value = err?.message || 'Could not load your wallet.'
  } finally {
    loading.value = false
  }
}

const reload = () => {
  page.value = 1
  load()
}

/**
 * The server's own limits, checked here first so the common mistakes are caught
 * without a round trip — and so the reason given is the same wording the
 * platform would have used anyway.
 */
const localProblem = computed(() => {
  const w = wallet.value
  const raw = String(form.value.amount || '').trim()
  if (!w || raw === '') return ''

  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) return 'Enter an amount greater than zero.'

  const minor = Math.round(value * 100)
  if (minor < Number(w.min_topup_minor || 0)) {
    return `The minimum top-up is ${currency(Number(w.min_topup_minor) / 100)}.`
  }
  if (w.max_topup_minor !== null && w.max_topup_minor !== undefined && minor > Number(w.max_topup_minor)) {
    return `The maximum top-up is ${currency(Number(w.max_topup_minor) / 100)}.`
  }
  return ''
})

const startTopup = async () => {
  if (starting.value || localProblem.value) return

  starting.value = true
  try {
    const res = await tenantApi.topup(
      {
        amount: Number(form.value.amount).toFixed(2),
        email: form.value.email.trim() || undefined,
      },
      idempotencyKey.value,
    )

    // Paid for this attempt: the next one is a fresh intent.
    idempotencyKey.value = newIdempotencyKey()
    toast('Opening secure payment…', 'success')
    window.location.href = res.data.authorization_url
  } catch (err) {
    toast(err?.message || 'Could not start that top-up.', 'error')
    starting.value = false
  }
}

// Paging re-reads only the ledger: the balance above does not change because
// somebody scrolled further down the list.
watch(page, load)

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <div class="clay flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-surface p-4 sm:p-5">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Wallet</h1>
        <p class="mt-0.5 text-xs text-muted">Prepaid credit — every order draws from this, every refund lands here.</p>
      </div>
      <div v-if="wallet" class="text-right">
        <p class="text-[10px] font-bold tracking-widest text-muted uppercase">Available</p>
        <p class="font-heading text-2xl font-black text-brand">{{ money(wallet.available_minor) }}</p>
        <p class="text-[11px] text-muted">
          of {{ money(wallet.balance_minor) }} held · reserve {{ money(wallet.min_balance_minor) }}
        </p>
      </div>
    </div>

    <LoadError :error="error" :busy="loading" @retry="load" />

    <div class="grid gap-5 lg:grid-cols-[340px_1fr]">
      <div class="space-y-5">
        <form class="clay rounded-2xl bg-surface p-4 sm:p-5" @submit.prevent="startTopup">
          <h2 class="font-heading text-sm font-bold tracking-tight text-brand-dark">Top up</h2>
          <p class="mt-0.5 text-[11px] text-muted">Card or mobile money, through Paystack.</p>

          <label class="mt-3 block">
            <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Amount (GHS)</span>
            <input
              v-model="form.amount"
              type="number"
              min="0"
              step="0.01"
              inputmode="decimal"
              placeholder="500.00"
              class="clay-well w-full rounded-xl bg-bg px-3.5 py-2.5 text-sm font-medium outline-none placeholder:text-muted/40"
            />
          </label>

          <span v-if="wallet" class="mt-1.5 block text-[10px] text-muted">
            {{ currency(Number(wallet.min_topup_minor || 0) / 100) }} minimum
            <template v-if="wallet.max_topup_minor"> · {{ currency(Number(wallet.max_topup_minor) / 100) }} maximum</template>
            <template v-if="wallet.max_topups_per_day"> · {{ wallet.max_topups_per_day }} per day</template>
          </span>

          <label class="mt-3 block">
            <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Email for the receipt (optional)</span>
            <input
              v-model="form.email"
              type="email"
              placeholder="accounts@yourcompany.com"
              class="clay-well w-full rounded-xl bg-bg px-3.5 py-2.5 text-sm outline-none placeholder:text-muted/40"
            />
          </label>

          <p v-if="localProblem" class="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700">
            {{ localProblem }}
          </p>

          <button
            type="submit"
            :disabled="starting || !!localProblem || !form.amount"
            class="mt-4 w-full rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-brand/25 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ starting ? 'Opening…' : 'Top up wallet' }}
          </button>
        </form>

        <div v-if="wallet" class="clay rounded-2xl bg-surface p-4 sm:p-5">
          <h2 class="font-heading text-sm font-bold tracking-tight text-brand-dark">Lifetime</h2>
          <dl class="mt-3 space-y-2 text-xs">
            <div class="flex items-center justify-between gap-3">
              <dt class="text-muted">Topped up</dt>
              <dd class="font-bold text-emerald-600">{{ money(wallet.lifetime_credit_minor) }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-muted">Spent</dt>
              <dd class="font-bold text-brand-dark">{{ money(wallet.lifetime_debit_minor) }}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div class="clay rounded-2xl bg-surface p-4 sm:p-5">
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-heading text-sm font-bold tracking-tight text-brand-dark">Ledger</h2>
          <span class="text-[10px] text-muted">every movement, newest first</span>
        </div>

        <p v-if="loading" class="py-8 text-center text-xs text-muted">Loading…</p>

        <p v-else-if="!entries.length" class="py-8 text-center text-xs text-muted">
          Nothing has moved yet.
        </p>

        <template v-else>
          <ul class="mt-3 space-y-2">
            <li
              v-for="e in entries"
              :key="e.id"
              class="flex items-center justify-between gap-3 rounded-xl bg-bg px-3.5 py-2.5"
            >
              <div class="min-w-0">
                <span
                  class="inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                  :class="entryMeta(e.type).cls"
                >{{ entryMeta(e.type).label }}</span>
                <p class="mt-1 truncate text-[11px] text-muted">
                  {{ e.description || formatDateTime(e.created_at) }}
                </p>
              </div>
              <div class="shrink-0 text-right">
                <p
                  class="font-heading text-sm font-black"
                  :class="e.direction === 'credit' ? 'text-emerald-600' : 'text-ink'"
                >
                  {{ e.direction === 'credit' ? '+' : '−' }}{{ money(e.amount_minor) }}
                </p>
                <p class="text-[10px] text-muted">left {{ money(e.balance_after_minor) }}</p>
              </div>
            </li>
          </ul>

          <Pagination v-model:page="page" :total-pages="meta.last_page" :total="meta.total" />
        </template>
      </div>
    </div>
  </div>
</template>
