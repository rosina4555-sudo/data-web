<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '../../services/api'
import { currency, formatDateTime } from '../../utils/format'
import { toast } from '../../services/toast'
import StatusPill from '../StatusPill.vue'

const props = defineProps({
  storeId: { type: Number, required: true },
})
const emit = defineEmits(['close', 'updated'])

const store = ref(null)
const loading = ref(true)
const error = ref('')
const status = ref('')
const notes = ref('')
const saving = ref(false)

const WITHDRAWAL_LABEL = {
  requested: 'Requested',
  approved: 'Approved',
  processing: 'Sending',
  paid: 'Paid',
  failed: 'Failed',
  rejected: 'Rejected',
}

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await adminApi.getStore(props.storeId)
    store.value = res.data
    status.value = res.data.status
    notes.value = res.data.notes || ''
  } catch (err) {
    error.value = err?.message || 'Could not load this store.'
  } finally {
    loading.value = false
  }
}

const save = async () => {
  if (saving.value) return
  saving.value = true
  try {
    const res = await adminApi.updateStore(props.storeId, { status: status.value, notes: notes.value })
    store.value = { ...store.value, ...res.data }
    toast('Store updated.', 'success')
    emit('updated')
  } catch (err) {
    toast(err?.message || 'Could not update this store.', 'error')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex justify-end bg-brand-dark/45 backdrop-blur-sm" role="dialog" aria-modal="true" @click.self="emit('close')">
      <div class="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-surface shadow-2xl">
        <div class="flex items-center justify-between border-b border-brand/10 px-5 py-4">
          <div class="min-w-0">
            <p class="text-[10px] font-extrabold tracking-widest text-muted uppercase">Storefront</p>
            <h2 class="truncate font-heading text-base font-bold text-brand-dark">{{ store?.name || 'Loading…' }}</h2>
          </div>
          <button type="button" aria-label="Close" class="flex h-8 w-8 items-center justify-center rounded-xl text-muted hover:bg-brand/5 hover:text-brand" @click="emit('close')">✕</button>
        </div>

        <div class="hide-scrollbar flex-1 overflow-y-auto px-5 py-4">
          <div v-if="loading" class="flex items-center justify-center py-20">
            <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand/15 border-t-brand"></div>
          </div>

          <div v-else-if="error" class="py-16 text-center">
            <p class="text-sm font-semibold text-red-600">{{ error }}</p>
            <button type="button" class="mt-3 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600" @click="load">Retry</button>
          </div>

          <template v-else-if="store">
            <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div class="rounded-2xl bg-bg p-3">
                <p class="text-[9px] font-bold tracking-widest text-muted uppercase">Balance</p>
                <p class="mt-0.5 font-heading text-lg font-black text-brand">{{ currency(store.balance_minor / 100) }}</p>
              </div>
              <div class="rounded-2xl bg-bg p-3">
                <p class="text-[9px] font-bold tracking-widest text-muted uppercase">Lifetime earned</p>
                <p class="mt-0.5 font-heading text-lg font-black text-brand-dark">{{ currency(store.lifetime_credit_minor / 100) }}</p>
              </div>
              <div class="rounded-2xl bg-bg p-3">
                <p class="text-[9px] font-bold tracking-widest text-muted uppercase">Sales</p>
                <p class="mt-0.5 font-heading text-lg font-black text-brand-dark">{{ currency(store.sales_minor / 100) }}</p>
              </div>
              <div class="rounded-2xl bg-bg p-3">
                <p class="text-[9px] font-bold tracking-widest text-muted uppercase">Orders</p>
                <p class="mt-0.5 font-heading text-lg font-black text-brand-dark">{{ store.orders_count }}</p>
              </div>
            </div>

            <dl class="mt-4 grid gap-x-4 gap-y-2 rounded-2xl border border-brand/10 p-4 text-xs sm:grid-cols-2">
              <div class="flex justify-between gap-2 sm:block">
                <dt class="text-[10px] font-bold tracking-widest text-muted uppercase">Shop link</dt>
                <dd class="font-mono font-semibold text-brand">#/s/{{ store.slug }}</dd>
              </div>
              <div class="flex justify-between gap-2 sm:block">
                <dt class="text-[10px] font-bold tracking-widest text-muted uppercase">Email</dt>
                <dd class="font-semibold text-brand-dark">{{ store.email }}</dd>
              </div>
              <div class="flex justify-between gap-2 sm:block">
                <dt class="text-[10px] font-bold tracking-widest text-muted uppercase">Payout destination</dt>
                <dd class="font-semibold text-brand-dark">
                  <template v-if="store.payout_account_number">
                    {{ store.payout_type === 'bank' ? 'Bank' : 'Mobile money' }} · {{ store.payout_bank_code }} ·
                    {{ store.payout_account_number }} ({{ store.payout_account_name }})
                  </template>
                  <span v-else class="text-amber-600">Not set up</span>
                </dd>
              </div>
              <div class="flex justify-between gap-2 sm:block">
                <dt class="text-[10px] font-bold tracking-widest text-muted uppercase">Paystack recipient</dt>
                <dd class="font-semibold" :class="store.has_recipient ? 'text-emerald-600' : 'text-muted'">
                  {{ store.has_recipient ? 'Created' : 'Not created yet' }}
                </dd>
              </div>
              <div class="flex justify-between gap-2 sm:block">
                <dt class="text-[10px] font-bold tracking-widest text-muted uppercase">Joined</dt>
                <dd class="font-semibold text-brand-dark">{{ formatDateTime(store.created_at) }}</dd>
              </div>
              <div class="flex justify-between gap-2 sm:block">
                <dt class="text-[10px] font-bold tracking-widest text-muted uppercase">Suspended</dt>
                <dd class="font-semibold text-brand-dark">{{ formatDateTime(store.suspended_at) }}</dd>
              </div>
            </dl>

            <div class="mt-4 rounded-2xl border border-brand/10 p-4">
              <h3 class="text-[10px] font-bold tracking-widest text-muted uppercase">Status &amp; notes</h3>
              <div class="mt-2 flex flex-wrap items-end gap-2">
                <label class="min-w-[9rem] flex-1">
                  <span class="mb-1 block text-[10px] font-semibold text-muted">Status</span>
                  <select v-model="status" class="clay-well w-full rounded-xl bg-bg px-3 py-2 text-xs font-semibold text-brand-dark outline-none">
                    <option value="active">Active</option>
                    <option value="pending">Pending activation</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </label>
                <label class="min-w-[12rem] flex-[2]">
                  <span class="mb-1 block text-[10px] font-semibold text-muted">Internal notes</span>
                  <input v-model="notes" type="text" maxlength="2000" placeholder="Only staff see this" class="clay-well w-full rounded-xl bg-bg px-3 py-2 text-xs text-brand-dark outline-none" />
                </label>
                <button type="button" :disabled="saving" class="clay-btn rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-xs font-extrabold text-white disabled:opacity-40" @click="save">
                  {{ saving ? 'Saving…' : 'Save' }}
                </button>
              </div>
              <p v-if="status === 'suspended'" class="mt-2 text-[11px] font-semibold text-amber-700">
                Suspending hides the shop and blocks the console immediately. Existing balances stay withdrawable.
              </p>
            </div>

            <div class="mt-4 rounded-2xl border border-brand/10">
              <h3 class="border-b border-brand/10 px-4 py-2.5 text-[10px] font-bold tracking-widest text-muted uppercase">Recent orders</h3>
              <div v-if="!store.orders?.length" class="px-4 py-5 text-xs text-muted">No orders yet.</div>
              <ul v-else class="divide-y divide-brand/5">
                <li v-for="o in store.orders" :key="o.reference" class="flex items-center justify-between gap-2 px-4 py-2.5 text-xs">
                  <div class="min-w-0">
                    <p class="font-mono font-bold text-brand">{{ o.reference }}</p>
                    <p class="truncate text-muted">{{ o.package }} · {{ formatDateTime(o.created_at) }}</p>
                  </div>
                  <div class="flex shrink-0 items-center gap-2">
                    <span class="font-heading font-black text-brand">{{ currency(o.amount_minor / 100) }}</span>
                    <StatusPill :status="o.status" small />
                  </div>
                </li>
              </ul>
            </div>

            <div class="mt-4 rounded-2xl border border-brand/10">
              <h3 class="border-b border-brand/10 px-4 py-2.5 text-[10px] font-bold tracking-widest text-muted uppercase">Recent withdrawals</h3>
              <div v-if="!store.withdrawals?.length" class="px-4 py-5 text-xs text-muted">No withdrawals yet.</div>
              <ul v-else class="divide-y divide-brand/5">
                <li v-for="w in store.withdrawals" :key="w.id" class="flex items-center justify-between gap-2 px-4 py-2.5 text-xs">
                  <div>
                    <p class="font-heading font-black text-brand-dark">{{ currency(w.amount_minor / 100) }}</p>
                    <p class="text-muted">{{ formatDateTime(w.created_at) }}</p>
                  </div>
                  <span class="rounded-full bg-bg px-2 py-0.5 text-[10px] font-bold text-muted">{{ WITHDRAWAL_LABEL[w.status] || w.status }}</span>
                </li>
              </ul>
            </div>

            <div class="mt-4 rounded-2xl border border-brand/10">
              <h3 class="border-b border-brand/10 px-4 py-2.5 text-[10px] font-bold tracking-widest text-muted uppercase">Prices</h3>
              <ul class="divide-y divide-brand/5">
                <li v-for="p in store.pricing?.filter((r) => r.sell_price_minor !== null)" :key="p.package_id" class="flex items-center justify-between gap-2 px-4 py-2.5 text-xs">
                  <div class="min-w-0">
                    <p class="truncate font-semibold text-brand-dark">{{ p.name }}</p>
                    <p class="text-[11px] text-muted">floor {{ currency(p.base_price_minor / 100) }} · you keep {{ currency(p.profit_minor / 100) }}</p>
                  </div>
                  <div class="text-right">
                    <p class="font-heading font-black text-brand">{{ currency(p.sell_price_minor / 100) }}</p>
                    <p class="text-[10px] font-bold" :class="p.sellable ? 'text-emerald-600' : 'text-red-500'">{{ p.sellable ? 'On sale' : 'Blocked' }}</p>
                  </div>
                </li>
              </ul>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>
