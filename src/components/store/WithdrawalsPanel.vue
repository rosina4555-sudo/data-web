<script setup>
import { ref, computed, onMounted } from 'vue'
import { storeApi } from '../../services/storeApi'
import { currency, formatDateTime } from '../../utils/format'
import { toast } from '../../services/toast'
import Pagination from '../admin/Pagination.vue'

const emit = defineEmits(['go-tab'])

const STATUS = {
  requested: { label: 'Awaiting approval', cls: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Approved', cls: 'bg-sky-50 text-sky-700' },
  processing: { label: 'Sending', cls: 'bg-violet-50 text-violet-700' },
  paid: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700' },
  failed: { label: 'Failed — returned', cls: 'bg-red-50 text-red-600' },
  rejected: { label: 'Rejected — returned', cls: 'bg-red-50 text-red-600' },
}

const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const rows = ref([])
const me = ref(null)
const amount = ref('')
const submitting = ref(false)
const loading = ref(true)
const loadError = ref('')

const policy = computed(() => me.value?.withdrawal_policy || { min_minor: 1000, max_minor: null, fee_minor: 0 })
const available = computed(() => me.value?.available_minor || 0)
const payoutReady = computed(() => !!me.value?.payout?.ready)
const amountMinor = computed(() => Math.round(Number(amount.value) * 100))
const feeMinor = computed(() => policy.value.fee_minor || 0)
// The fee is held on top of the payout: enter what you want to receive, the
// balance is debited amount + fee.
const totalHoldMinor = computed(() => (Number.isFinite(amountMinor.value) ? amountMinor.value + feeMinor.value : 0))

const minMajor = computed(() => (policy.value.min_minor || 0) / 100)
const maxMajor = computed(() => (policy.value.max_minor ? policy.value.max_minor / 100 : null))

const amountError = computed(() => {
  if (!amount.value) return ''
  if (!Number.isFinite(amountMinor.value) || amountMinor.value <= 0) return 'Enter an amount greater than zero.'
  if (totalHoldMinor.value > available.value) {
    return feeMinor.value
      ? `You can receive at most ${currency((available.value - feeMinor.value) / 100)} — the ${currency(feeMinor.value / 100)} fee comes out of your balance too.`
      : `You can withdraw at most ${currency(available.value / 100)}.`
  }
  if (amountMinor.value < policy.value.min_minor) return `The minimum withdrawal is ${currency(minMajor.value)}.`
  if (policy.value.max_minor && amountMinor.value > policy.value.max_minor) return `The maximum withdrawal is ${currency(maxMajor.value)}.`
  return ''
})

const canSubmit = computed(
  () => !!amount.value && !amountError.value && payoutReady.value && !submitting.value && amountMinor.value > 0,
)

const load = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const [profile, list] = await Promise.all([
      storeApi.me(),
      storeApi.withdrawals({ page: meta.value.current_page, per_page: 15 }),
    ])
    me.value = profile.data
    rows.value = list.data || []
    meta.value = list.meta || meta.value
  } catch (err) {
    loadError.value = err?.message || 'Could not load your payouts.'
    toast(loadError.value, 'error')
  } finally {
    loading.value = false
  }
}

const submit = async () => {
  if (!canSubmit.value) return
  submitting.value = true
  try {
    await storeApi.requestWithdrawal(amountMinor.value)
    toast('Withdrawal requested — we will review it shortly.', 'success')
    amount.value = ''
    meta.value = { ...meta.value, current_page: 1 }
    await load()
  } catch (err) {
    toast(err?.message || 'Could not request that withdrawal.', 'error')
  } finally {
    submitting.value = false
  }
}

const goPage = (page) => {
  meta.value = { ...meta.value, current_page: page }
  load()
}

const statusMeta = (status) => STATUS[status] || { label: status || '—', cls: 'bg-slate-100 text-slate-500' }

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Payouts</h1>
      <p class="text-xs font-medium text-muted">Withdraw your profit to mobile money or your bank.</p>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand/15 border-t-brand"></div>
    </div>

    <div v-else-if="loadError" class="clay rounded-3xl bg-surface py-10 text-center">
      <p class="text-sm font-semibold text-red-600">{{ loadError }}</p>
      <button type="button" class="mt-3 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600" @click="load">Retry</button>
    </div>

    <template v-else>
      <div class="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div class="clay rounded-3xl bg-surface p-5">
          <p class="text-[10px] font-bold tracking-widest text-muted uppercase">Available to withdraw</p>
          <p class="mt-1 font-heading text-3xl font-black text-brand">{{ currency(available / 100) }}</p>
          <p class="mt-1 text-[11px] text-muted">
            Minimum {{ currency(minMajor) }}<template v-if="maxMajor"> · maximum {{ currency(maxMajor) }}</template>
            <template v-if="feeMinor"> · {{ currency(feeMinor / 100) }} fee added per payout</template>
          </p>

          <div v-if="!payoutReady" class="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
            <p class="text-xs font-bold text-amber-800">Add payout details to continue</p>
            <p class="mt-0.5 text-[11px] text-amber-700">Money can only be sent to an account you have saved.</p>
            <button type="button" class="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white" @click="emit('go-tab', 'settings')">
              Set up payouts
            </button>
          </div>

          <form class="mt-4 space-y-3" @submit.prevent="submit">
            <label class="block">
              <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Amount to withdraw</span>
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-muted">₵</span>
                <input
                  v-model="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  inputmode="decimal"
                  :placeholder="minMajor.toFixed(2)"
                  class="clay-well w-full rounded-2xl bg-bg px-4 py-3 text-base font-semibold text-brand-dark outline-none"
                />
                <button
                  type="button"
                  class="shrink-0 rounded-xl bg-brand-soft px-3 py-2.5 text-[11px] font-bold text-brand"
                  @click="amount = Math.max(0, available - feeMinor) / 100 ? (Math.max(0, available - feeMinor) / 100).toFixed(2) : ''"
                >
                  Max
                </button>
              </div>
              <span v-if="amountError" class="mt-1.5 block text-[11px] font-semibold text-red-500">{{ amountError }}</span>
              <span v-else-if="amountMinor > 0" class="mt-1.5 block text-[11px] text-muted">
                You receive <b class="text-brand-dark">{{ currency(amountMinor / 100) }}</b>.
                <template v-if="feeMinor">
                  {{ currency(totalHoldMinor / 100) }} leaves your balance, including the
                  {{ currency(feeMinor / 100) }} fee.
                </template>
              </span>
            </label>

            <button
              type="submit"
              :disabled="!canSubmit"
              class="clay-btn w-full rounded-2xl bg-gradient-to-r from-brand to-brand-dark py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {{ submitting ? 'Requesting…' : 'Request withdrawal' }}
            </button>
          </form>

          <p class="mt-3 text-[11px] leading-relaxed text-muted/80">
            The payout and any fee leave your available balance immediately. If the request is
            rejected or the transfer fails, the full amount is returned to your balance automatically.
          </p>
        </div>

        <div class="clay rounded-3xl bg-surface p-5">
          <h2 class="text-xs font-bold tracking-widest text-muted uppercase">How it works</h2>
          <ol class="mt-3 space-y-3">
            <li class="flex gap-2.5">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-black text-brand">1</span>
              <p class="text-xs leading-relaxed text-muted"><b class="text-brand-dark">You request.</b> The amount is held so it cannot be spent or requested twice.</p>
            </li>
            <li class="flex gap-2.5">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-black text-brand">2</span>
              <p class="text-xs leading-relaxed text-muted"><b class="text-brand-dark">We review.</b> An operator checks the destination account, then sends the transfer.</p>
            </li>
            <li class="flex gap-2.5">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-black text-brand">3</span>
              <p class="text-xs leading-relaxed text-muted"><b class="text-brand-dark">It arrives.</b> Mobile money is usually instant. If it fails, your money comes back.</p>
            </li>
          </ol>
        </div>
      </div>

      <div class="clay overflow-hidden rounded-3xl bg-surface">
        <div class="border-b border-brand/10 px-4 py-3">
          <h2 class="text-xs font-bold tracking-widest text-muted uppercase">Withdrawal history</h2>
        </div>

        <div v-if="!rows.length" class="px-4 py-10 text-center">
          <p class="font-heading text-sm font-bold text-brand-dark/70">No withdrawals yet</p>
          <p class="mt-1 text-xs text-muted">Your requests and their progress will appear here.</p>
        </div>

        <ul v-else class="divide-y divide-brand/5">
          <li v-for="w in rows" :key="w.id" class="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p class="font-heading text-sm font-black text-brand-dark">{{ currency(w.amount_minor / 100) }}</p>
              <p class="mt-0.5 text-[11px] text-muted">
                Requested {{ formatDateTime(w.requested_at) }}
                <template v-if="w.fee_minor"> · fee {{ currency(w.fee_minor / 100) }}</template>
              </p>
              <p v-if="w.failure_reason" class="mt-0.5 text-[11px] font-semibold text-red-500">{{ w.failure_reason }}</p>
            </div>
            <div class="text-right">
              <span class="rounded-full px-2.5 py-1 text-[10px] font-bold" :class="statusMeta(w.status).cls">
                {{ statusMeta(w.status).label }}
              </span>
              <p v-if="w.paid_at" class="mt-1 text-[10px] text-muted">Paid {{ formatDateTime(w.paid_at) }}</p>
            </div>
          </li>
        </ul>
      </div>

      <Pagination :page="meta.current_page" :total-pages="meta.last_page" :total="meta.total" @update:page="goPage" />
    </template>
  </div>
</template>
