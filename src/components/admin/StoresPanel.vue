<script setup>
import { ref, computed, onMounted, onDeactivated } from 'vue'
import { adminApi } from '../../services/api'
import { currency, formatDateTime, timeAgo } from '../../utils/format'
import { toast } from '../../services/toast'
import Pagination from './Pagination.vue'
import StoreDetailSheet from './StoreDetailSheet.vue'

const section = ref('stores')

const SECTIONS = [
  { id: 'stores', label: 'Stores' },
  { id: 'pricing', label: 'Base prices' },
  { id: 'withdrawals', label: 'Withdrawals' },
]

/* ---------------------------------------------------------------- stores -- */

const storeFilters = ref({ q: '', status: '' })
const stores = ref([])
const storeMeta = ref({ current_page: 1, last_page: 1, total: 0 })
const storesLoading = ref(true)
const storesError = ref('')
const detailId = ref(null)
// A 404 is not "you lack permission": it means this API build does not serve
// the storefront routes at all. Say so once, above every section, instead of
// letting each panel look like a different kind of failure.
const apiMissing = ref(false)

const noteFailure = (err) => {
  if (err?.status === 404) apiMissing.value = true
}

const loadStores = async () => {
  storesLoading.value = true
  storesError.value = ''
  try {
    const params = { page: storeMeta.value.current_page, per_page: 20 }
    if (storeFilters.value.q) params.q = storeFilters.value.q
    if (storeFilters.value.status) params.status = storeFilters.value.status
    const res = await adminApi.getStores(params)
    stores.value = res.data || []
    storeMeta.value = res.meta || storeMeta.value
  } catch (err) {
    storesError.value = err?.message || 'Could not load stores.'
    noteFailure(err)
  } finally {
    storesLoading.value = false
  }
}

let searchTimer
const onSearch = () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    storeMeta.value = { ...storeMeta.value, current_page: 1 }
    loadStores()
  }, 300)
}

const goStorePage = (page) => {
  storeMeta.value = { ...storeMeta.value, current_page: page }
  loadStores()
}

const STORE_STATUS = {
  active: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  suspended: 'bg-red-50 text-red-600',
}

/* --------------------------------------------------------------- pricing -- */

const prices = ref([])
const priceFilter = ref('')
const pricesLoading = ref(true)
const pricesError = ref('')
const drafts = ref({})
const savingPrice = ref(null)

const loadPrices = async () => {
  pricesLoading.value = true
  pricesError.value = ''
  try {
    const res = await adminApi.getStoreBasePrices()
    prices.value = res.data || []
    drafts.value = Object.fromEntries(
      prices.value.map((p) => [
        p.package_id,
        {
          price: p.base_price_minor !== null ? (p.base_price_minor / 100).toFixed(2) : '',
          active: p.is_active,
        },
      ]),
    )
  } catch (err) {
    pricesError.value = err?.message || 'Could not load base prices.'
    noteFailure(err)
  } finally {
    pricesLoading.value = false
  }
}

const visiblePrices = computed(() => {
  const q = priceFilter.value.trim().toLowerCase()
  if (!q) return prices.value
  return prices.value.filter(
    (p) =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.network || '').toLowerCase().includes(q),
  )
})

/** A floor above the list price means the package is priced below cost. */
const draftWarning = (p) => {
  const d = drafts.value[p.package_id]
  if (!d?.price) return ''
  const minor = Math.round(Number(d.price) * 100)
  if (!Number.isFinite(minor) || minor <= 0) return 'Enter an amount greater than zero.'
  if (p.list_price_minor !== null && minor >= p.list_price_minor) {
    return `This floor is at or above the shop list price (${currency(p.list_price_minor / 100)}), so the package stops being sellable until a store raises its price.`
  }
  if (p.provider_cost_minor !== null && minor < p.provider_cost_minor) {
    return `Below provider cost (${currency(p.provider_cost_minor / 100)}) — margin would be negative.`
  }
  return ''
}

const savePrice = async (p) => {
  const d = drafts.value[p.package_id]
  if (!d?.price || savingPrice.value) return
  savingPrice.value = p.package_id
  try {
    const res = await adminApi.setStoreBasePrice(p.package_id, {
      base_price: Number(d.price).toFixed(2),
      is_active: !!d.active,
    })
    const row = res.data
    prices.value = prices.value.map((r) =>
      r.package_id === p.package_id
        ? { ...r, base_price_minor: row.base_price_minor, is_active: row.is_active }
        : r,
    )
    toast(`Floor for ${p.name} saved.`, 'success')
  } catch (err) {
    toast(err?.message || 'Could not save that floor.', 'error')
  } finally {
    savingPrice.value = null
  }
}

/* ----------------------------------------------------------- withdrawals -- */

const withdrawalStatus = ref('requested')
const withdrawals = ref([])
const withdrawalMeta = ref({ current_page: 1, last_page: 1, total: 0 })
const withdrawalsLoading = ref(true)
const withdrawalsError = ref('')
const busyId = ref(null)
const approveTarget = ref(null)
const rejectTarget = ref(null)
const rejectReason = ref('')

const WITHDRAWAL_STATUS = {
  requested: { label: 'Requested', cls: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Approved', cls: 'bg-sky-50 text-sky-700' },
  processing: { label: 'Sending', cls: 'bg-violet-50 text-violet-700' },
  paid: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700' },
  failed: { label: 'Failed', cls: 'bg-red-50 text-red-600' },
  rejected: { label: 'Rejected', cls: 'bg-slate-100 text-slate-500' },
}

const WITHDRAWAL_TABS = [
  { id: 'requested', label: 'Requested' },
  { id: 'approved', label: 'Approved' },
  { id: 'processing', label: 'Sending' },
  { id: 'paid', label: 'Paid' },
  { id: 'failed', label: 'Failed' },
  { id: 'rejected', label: 'Rejected' },
  { id: '', label: 'All' },
]

const loadWithdrawals = async () => {
  withdrawalsLoading.value = true
  withdrawalsError.value = ''
  try {
    const params = { page: withdrawalMeta.value.current_page, per_page: 20 }
    if (withdrawalStatus.value) params.status = withdrawalStatus.value
    const res = await adminApi.getStoreWithdrawals(params)
    withdrawals.value = res.data || []
    withdrawalMeta.value = res.meta || withdrawalMeta.value
  } catch (err) {
    withdrawalsError.value = err?.message || 'Could not load withdrawals.'
    noteFailure(err)
  } finally {
    withdrawalsLoading.value = false
  }
}

const setWithdrawalStatus = (id) => {
  withdrawalStatus.value = id
  withdrawalMeta.value = { ...withdrawalMeta.value, current_page: 1 }
  loadWithdrawals()
}

const goWithdrawalPage = (page) => {
  withdrawalMeta.value = { ...withdrawalMeta.value, current_page: page }
  loadWithdrawals()
}

const destination = (w) => {
  const s = w.store
  if (!s?.payout_account_number) return 'No destination saved'
  return `${s.payout_type === 'bank' ? 'Bank' : 'Mobile money'} · ${s.payout_bank_code} · ${s.payout_account_number} (${s.payout_account_name})`
}

const runWithdrawal = async (w, fn, message) => {
  busyId.value = w.id
  try {
    await fn()
    toast(message, 'success')
    await loadWithdrawals()
  } catch (err) {
    toast(err?.message || 'That action did not go through.', 'error')
  } finally {
    busyId.value = null
  }
}

const confirmApprove = async () => {
  const w = approveTarget.value
  if (!w) return
  approveTarget.value = null
  await runWithdrawal(
    w,
    () => adminApi.approveStoreWithdrawal(w.id),
    'Transfer queued with Paystack.',
  )
}

const confirmReject = async () => {
  const w = rejectTarget.value
  if (!w) return
  const reason = rejectReason.value.trim()
  rejectTarget.value = null
  rejectReason.value = ''
  await runWithdrawal(
    w,
    () => adminApi.rejectStoreWithdrawal(w.id, reason),
    'Withdrawal rejected and returned to the store balance.',
  )
}

const retryWithdrawal = async (w) => {
  await runWithdrawal(w, () => adminApi.retryStoreWithdrawal(w.id), 'Transfer re-attempted.')
}

/* ------------------------------------------------------------------ boot -- */

const switchSection = (id) => {
  section.value = id
  if (id === 'pricing' && !prices.value.length) loadPrices()
  if (id === 'withdrawals' && !withdrawals.value.length) loadWithdrawals()
}

onMounted(() => {
  loadStores()
  loadPrices()
  loadWithdrawals()
})

// The tab is kept alive, so an open drawer or confirmation dialog would keep
// floating over whichever panel the operator switches to next.
onDeactivated(() => {
  approveTarget.value = null
  rejectTarget.value = null
  detailId.value = null
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Storefronts</h1>
        <p class="text-xs font-medium text-muted">Shops selling your bundles, their prices, and the money leaving for them.</p>
      </div>
      <div class="flex gap-1 rounded-2xl bg-brand/5 p-1">
        <button
          v-for="s in SECTIONS"
          :key="s.id"
          type="button"
          class="rounded-xl px-3 py-1.5 text-xs font-bold transition"
          :class="section === s.id ? 'bg-surface text-brand shadow-sm' : 'text-muted hover:text-brand'"
          @click="switchSection(s.id)"
        >
          {{ s.label }}
        </button>
      </div>
    </div>

    <div v-if="apiMissing" class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-relaxed text-amber-800">
      <b>This server does not have the storefront service yet.</b>
      The console is up to date, but the API it is talking to is an older build.
      Point the app at the updated backend (or deploy it) and reload this tab.
    </div>

    <!-- ============================================================ stores -->
    <template v-if="section === 'stores'">
      <div class="flex flex-wrap gap-2">
        <input
          v-model="storeFilters.q"
          type="search"
          placeholder="Search name, slug or email…"
          class="clay-well min-w-[12rem] flex-1 rounded-xl bg-surface px-3.5 py-2 text-xs font-medium text-brand-dark outline-none placeholder:text-muted/60"
          @input="onSearch"
        />
        <select
          v-model="storeFilters.status"
          class="clay-well rounded-xl bg-surface px-3 py-2 text-xs font-semibold text-brand-dark outline-none"
          @change="onSearch"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
        </select>
        <button type="button" class="rounded-xl bg-brand-soft px-3.5 py-2 text-xs font-bold text-brand" @click="loadStores">↻</button>
      </div>

      <div v-if="storesLoading" class="flex items-center justify-center py-20">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand/15 border-t-brand"></div>
      </div>

      <div v-else-if="storesError" class="clay rounded-3xl bg-surface py-10 text-center">
        <p class="text-sm font-semibold text-red-600">{{ storesError }}</p>
        <button type="button" class="mt-3 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600" @click="loadStores">Retry</button>
        <p v-if="!apiMissing" class="mx-auto mt-2 max-w-md text-[11px] text-muted">
          If this looks wrong, your admin account may be missing the <b>can_manage_stores</b> permission.
        </p>
      </div>

      <div v-else-if="!stores.length" class="clay rounded-3xl bg-surface py-14 text-center">
        <p class="font-heading text-base font-bold text-brand-dark/70">No shops match</p>
        <p class="mt-1 text-sm text-muted">Sellers appear here as soon as they register.</p>
      </div>

      <div v-else class="clay overflow-hidden rounded-3xl bg-surface">
        <div class="hidden border-b border-brand/10 px-4 py-2 text-[10px] font-bold tracking-widest text-muted uppercase sm:grid sm:grid-cols-[1.6fr_1fr_0.9fr_0.9fr_0.6fr] sm:gap-3">
          <span>Shop</span>
          <span>Balance</span>
          <span>Payouts</span>
          <span>Status</span>
          <span></span>
        </div>
        <button
          v-for="s in stores"
          :key="s.id"
          type="button"
          class="block w-full border-b border-brand/5 px-4 py-3 text-left transition last:border-0 hover:bg-brand/[0.03]"
          @click="detailId = s.id"
        >
          <div class="flex items-start justify-between gap-3 sm:grid sm:grid-cols-[1.6fr_1fr_0.9fr_0.9fr_0.6fr] sm:items-center sm:gap-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-bold text-brand-dark">{{ s.name }}</p>
              <p class="truncate text-[11px] text-muted">#/s/{{ s.slug }} · {{ s.email }}</p>
            </div>
            <div class="text-right sm:text-left">
              <p class="font-heading text-sm font-black text-brand">{{ currency(s.balance_minor / 100) }}</p>
              <p class="text-[10px] text-muted sm:hidden">balance</p>
            </div>
            <div class="hidden sm:block">
              <span class="text-[11px] font-semibold" :class="s.payout_ready ? 'text-emerald-600' : 'text-amber-600'">
                {{ s.payout_ready ? 'Ready' : 'Not set up' }}
              </span>
            </div>
            <div>
              <span class="rounded-full px-2 py-0.5 text-[10px] font-bold" :class="STORE_STATUS[s.status] || 'bg-slate-100 text-slate-500'">
                {{ s.status }}
              </span>
            </div>
            <div class="hidden text-right text-[10px] font-semibold text-muted sm:block">Open →</div>
          </div>
        </button>
      </div>

      <Pagination :page="storeMeta.current_page" :total-pages="storeMeta.last_page" :total="storeMeta.total" @update:page="goStorePage" />
    </template>

    <!-- =========================================================== pricing -->
    <template v-else-if="section === 'pricing'">
      <div class="rounded-2xl border border-brand/10 bg-brand/[0.03] px-4 py-3 text-[11px] leading-relaxed text-muted">
        The floor is the least a shop may charge you for a bundle. Shops set their own sell price
        above it and keep the difference; the storefront refuses any price below the floor.
        Setting a floor above a shop's current price hides that bundle from that shop until it re-prices.
      </div>

      <input
        v-model="priceFilter"
        type="search"
        placeholder="Filter bundles…"
        class="clay-well w-full rounded-xl bg-surface px-3.5 py-2 text-xs font-medium text-brand-dark outline-none placeholder:text-muted/60"
      />

      <div v-if="pricesLoading" class="flex items-center justify-center py-20">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand/15 border-t-brand"></div>
      </div>

      <div v-else-if="pricesError" class="clay rounded-3xl bg-surface py-10 text-center">
        <p class="text-sm font-semibold text-red-600">{{ pricesError }}</p>
        <button type="button" class="mt-3 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600" @click="loadPrices">Retry</button>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="p in visiblePrices"
          :key="p.package_id"
          class="clay rounded-2xl bg-surface p-3.5"
        >
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate text-sm font-bold text-brand-dark">{{ p.name }}</p>
              <p class="text-[11px] text-muted">
                {{ p.network }} · {{ p.size_label || '—' }} · provider {{ p.provider_cost_minor !== null ? currency(p.provider_cost_minor / 100) : '—' }} ·
                list {{ currency(p.list_price_minor / 100) }}
                <span v-if="!p.package_is_active" class="ml-1 font-bold text-red-500">(bundle off)</span>
              </p>
            </div>
            <span class="rounded-full px-2 py-0.5 text-[10px] font-bold" :class="p.base_price_minor !== null ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
              {{ p.base_price_minor !== null ? currency(p.base_price_minor / 100) + ' floor' : 'No floor set' }}
            </span>
          </div>

          <div class="mt-2.5 flex flex-wrap items-center gap-2">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-muted">₵</span>
              <input
                v-model="drafts[p.package_id].price"
                type="number"
                min="0.01"
                step="0.01"
                inputmode="decimal"
                placeholder="0.00"
                class="clay-well w-24 rounded-xl bg-bg px-2.5 py-1.5 text-sm font-semibold text-brand-dark outline-none"
              />
            </div>
            <label class="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
              <input v-model="drafts[p.package_id].active" type="checkbox" class="accent-brand" />
              Sellable
            </label>
            <button
              type="button"
              :disabled="!drafts[p.package_id].price || savingPrice === p.package_id"
              class="clay-btn ml-auto rounded-xl bg-gradient-to-r from-brand to-brand-dark px-3.5 py-1.5 text-[11px] font-extrabold text-white disabled:opacity-40"
              @click="savePrice(p)"
            >
              {{ savingPrice === p.package_id ? 'Saving…' : 'Save' }}
            </button>
          </div>

          <p v-if="draftWarning(p)" class="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
            {{ draftWarning(p) }}
          </p>
        </div>

        <p v-if="!visiblePrices.length" class="py-10 text-center text-sm text-muted">No bundles match that filter.</p>
      </div>
    </template>

    <!-- ======================================================= withdrawals -->
    <template v-else>
      <div class="hide-scrollbar flex gap-1 overflow-x-auto">
        <button
          v-for="t in WITHDRAWAL_TABS"
          :key="t.id"
          type="button"
          class="shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-bold transition"
          :class="withdrawalStatus === t.id ? 'bg-brand text-white' : 'bg-surface text-muted hover:text-brand'"
          @click="setWithdrawalStatus(t.id)"
        >
          {{ t.label }}
        </button>
      </div>

      <div v-if="withdrawalsLoading" class="flex items-center justify-center py-20">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand/15 border-t-brand"></div>
      </div>

      <div v-else-if="withdrawalsError" class="clay rounded-3xl bg-surface py-10 text-center">
        <p class="text-sm font-semibold text-red-600">{{ withdrawalsError }}</p>
        <button type="button" class="mt-3 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600" @click="loadWithdrawals">Retry</button>
      </div>

      <div v-else-if="!withdrawals.length" class="clay rounded-3xl bg-surface py-14 text-center">
        <p class="font-heading text-base font-bold text-brand-dark/70">Nothing in this queue</p>
        <p class="mt-1 text-sm text-muted">Approved transfers still waiting on Paystack appear under Sending.</p>
      </div>

      <div v-else class="space-y-2">
        <div v-for="w in withdrawals" :key="w.id" class="clay rounded-2xl bg-surface p-4">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0">
              <button type="button" class="truncate text-sm font-bold text-brand-dark hover:text-brand" @click="detailId = w.store?.id">
                {{ w.store?.name || 'Unknown store' }}
              </button>
              <p class="mt-0.5 truncate text-[11px] text-muted">{{ destination(w) }}</p>
            </div>
            <div class="text-right">
              <p class="font-heading text-base font-black text-brand-dark">{{ currency(w.amount_minor / 100) }}</p>
              <span class="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold" :class="WITHDRAWAL_STATUS[w.status]?.cls || 'bg-slate-100 text-slate-500'">
                {{ WITHDRAWAL_STATUS[w.status]?.label || w.status }}
              </span>
            </div>
          </div>

          <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted">
            <span>Requested {{ formatDateTime(w.requested_at) }} ({{ timeAgo(w.requested_at) }})</span>
            <span v-if="w.fee_minor">· Fee {{ currency(w.fee_minor / 100) }}</span>
            <span v-if="w.attempts">· {{ w.attempts }} attempt{{ w.attempts === 1 ? '' : 's' }}</span>
            <span v-if="w.reference" class="font-mono">· {{ w.reference }}</span>
            <span v-if="w.paid_at">· Paid {{ formatDateTime(w.paid_at) }}</span>
          </div>

          <p v-if="w.failure_reason" class="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-600">
            {{ w.failure_reason }}
          </p>

          <div class="mt-3 flex flex-wrap gap-2">
            <template v-if="w.status === 'requested'">
              <button
                type="button"
                :disabled="busyId === w.id"
                class="clay-btn rounded-xl bg-gradient-to-r from-brand to-brand-dark px-3.5 py-1.5 text-[11px] font-extrabold text-white disabled:opacity-40"
                @click="approveTarget = w"
              >
                Approve &amp; send
              </button>
              <button
                type="button"
                :disabled="busyId === w.id"
                class="rounded-xl bg-red-50 px-3.5 py-1.5 text-[11px] font-bold text-red-600 disabled:opacity-40"
                @click="rejectTarget = w; rejectReason = ''"
              >
                Reject
              </button>
            </template>
            <button
              v-else-if="w.status === 'approved'"
              type="button"
              :disabled="busyId === w.id"
              class="clay-btn rounded-xl bg-gradient-to-r from-brand to-brand-dark px-3.5 py-1.5 text-[11px] font-extrabold text-white disabled:opacity-40"
              @click="retryWithdrawal(w)"
            >
              {{ busyId === w.id ? 'Sending…' : 'Send / retry transfer' }}
            </button>
            <span v-else-if="w.status === 'processing'" class="text-[11px] font-semibold text-violet-600">
              Paystack has it — waiting for confirmation.
            </span>
            <span v-else-if="w.status === 'failed'" class="text-[11px] text-muted">
              Hold released. The store must request again.
            </span>
          </div>
        </div>
      </div>

      <Pagination :page="withdrawalMeta.current_page" :total-pages="withdrawalMeta.last_page" :total="withdrawalMeta.total" @update:page="goWithdrawalPage" />
    </template>

    <StoreDetailSheet
      v-if="detailId"
      :store-id="detailId"
      @close="detailId = null"
      @updated="loadStores()"
    />

    <!-- Approve confirmation: destination is repeated here on purpose, because
         pressing Approve sends real money and the account is the last check. -->
    <Teleport v-if="approveTarget" to="body">
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-brand-dark/50 p-4 backdrop-blur-sm" @click.self="approveTarget = null">
        <div class="w-full max-w-md rounded-3xl bg-surface p-5 shadow-2xl">
          <h2 class="font-heading text-base font-bold text-brand-dark">Send {{ currency(approveTarget.amount_minor / 100) }}?</h2>
          <p class="mt-1 text-xs text-muted">
            to <b class="text-brand-dark">{{ approveTarget.store?.name }}</b>
          </p>
          <p class="mt-2 rounded-xl bg-bg px-3 py-2 text-[11px] font-semibold text-brand-dark">
            {{ destination(approveTarget) }}
          </p>
          <p class="mt-2 text-[11px] text-muted">
            This creates a Paystack recipient (if needed) and starts the transfer immediately.
            It cannot be undone from here.
          </p>
          <div class="mt-4 flex gap-2">
            <button type="button" class="flex-1 rounded-xl bg-brand/5 py-2.5 text-xs font-bold text-muted" @click="approveTarget = null">Cancel</button>
            <button type="button" class="clay-btn flex-1 rounded-xl bg-gradient-to-r from-brand to-brand-dark py-2.5 text-xs font-extrabold text-white" @click="confirmApprove">
              Approve &amp; send
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Reject confirmation -->
    <Teleport v-if="rejectTarget" to="body">
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-brand-dark/50 p-4 backdrop-blur-sm" @click.self="rejectTarget = null">
        <div class="w-full max-w-md rounded-3xl bg-surface p-5 shadow-2xl">
          <h2 class="font-heading text-base font-bold text-brand-dark">Reject this withdrawal?</h2>
          <p class="mt-1 text-xs text-muted">
            {{ currency(rejectTarget.amount_minor / 100) }} goes back to
            <b class="text-brand-dark">{{ rejectTarget.store?.name }}</b>'s available balance. They can request again.
          </p>
          <label class="mt-3 block">
            <span class="mb-1 block text-[11px] font-bold text-brand-dark/70">Reason (visible to the store)</span>
            <textarea v-model="rejectReason" rows="3" maxlength="500" placeholder="e.g. Account name does not match the mobile money number." class="clay-well w-full rounded-xl bg-bg px-3 py-2 text-xs text-brand-dark outline-none placeholder:text-muted/50"></textarea>
          </label>
          <div class="mt-4 flex gap-2">
            <button type="button" class="flex-1 rounded-xl bg-brand/5 py-2.5 text-xs font-bold text-muted" @click="rejectTarget = null">Cancel</button>
            <button type="button" class="clay-btn flex-1 rounded-xl bg-red-500 py-2.5 text-xs font-extrabold text-white" @click="confirmReject">Reject</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
