<script setup>
/**
 * Partner drill-down.
 *
 * Scope is deliberately the partner's own record: identity, lifecycle, tier, a
 * short order list and their audit trail. Wallet, keys and settlements each have
 * a dedicated tab in the console — duplicating them here would mean two screens
 * that can disagree about a balance.
 */
import { ref, watch } from 'vue'
import { partnerApi } from '../../services/partnerApi'
import { toast } from '../../services/toast'
import { tenantStatusMeta, auditMeta, money } from '../../utils/partners'
import { formatDateTime } from '../../utils/format'
import Pagination from '../admin/Pagination.vue'

const props = defineProps({
  tenantId: { type: Number, required: true },
  tiers: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'changed'])

const tab = ref('profile')
const tenant = ref(null)
const orders = ref([])
const orderMeta = ref({ current_page: 1, last_page: 1, total: 0 })
const orderPage = ref(1)
const audit = ref([])
const auditPages = ref({ current_page: 1, last_page: 1, total: 0 })
const auditPage = ref(1)
const loading = ref(true)
const error = ref('')

const busy = ref(false)
const changingTier = ref(false)
const nextTierId = ref('')
const tierReason = ref('')

const loadTenant = async () => {
  const res = await partnerApi.getTenant(props.tenantId)
  tenant.value = res.data
  nextTierId.value = res.data.account_type?.id ?? ''
}

const loadOrders = async () => {
  const res = await partnerApi.getTenantOrders(props.tenantId, { page: orderPage.value, per_page: 8 })
  orders.value = res.data
  orderMeta.value = res.meta
}

const loadAudit = async () => {
  const res = await partnerApi.getTenantAudit(props.tenantId, { page: auditPage.value, per_page: 12 })
  audit.value = res.data
  auditPages.value = res.meta
}

const init = async () => {
  loading.value = true
  error.value = ''
  try {
    await loadTenant()
    await Promise.all([loadOrders(), loadAudit()])
  } catch (err) {
    error.value = err?.message || 'Could not load this partner.'
  } finally {
    loading.value = false
  }
}

watch(() => props.tenantId, init, { immediate: true })
watch(orderPage, loadOrders)
watch(auditPage, loadAudit)

const afterChange = () => {
  emit('changed')
  init()
}

const suspend = async () => {
  const reason = window.prompt(`Why are you suspending ${tenant.value.name}?`)
  if (reason === null) return
  busy.value = true
  try {
    await partnerApi.suspendTenant(tenant.value.id, reason)
    toast(`${tenant.value.name} suspended`, 'success')
    afterChange()
  } catch (err) {
    toast(err?.message || 'Could not suspend.', 'error')
  } finally {
    busy.value = false
  }
}

const activate = async () => {
  busy.value = true
  try {
    await partnerApi.activateTenant(tenant.value.id)
    toast(`${tenant.value.name} reactivated`, 'success')
    afterChange()
  } catch (err) {
    toast(err?.message || 'Could not reactivate.', 'error')
  } finally {
    busy.value = false
  }
}

const saveTier = async () => {
  if (busy.value) return
  if (Number(nextTierId.value) === Number(tenant.value.account_type?.id)) return
  busy.value = true
  changingTier.value = true
  try {
    await partnerApi.changeAccountType(tenant.value.id, Number(nextTierId.value), tierReason.value)
    toast('Tier changed', 'success')
    tierReason.value = ''
    afterChange()
  } catch (err) {
    toast(err?.message || 'Could not change tier.', 'error')
  } finally {
    busy.value = false
    changingTier.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex justify-end bg-brand-dark/45 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      @click.self="emit('close')"
    >
      <div class="clay flex h-full w-full flex-col overflow-hidden rounded-l-3xl bg-surface sm:max-w-2xl">
        <div class="flex shrink-0 items-start justify-between gap-3 border-b border-brand/10 px-5 py-4">
          <div class="min-w-0">
            <p class="truncate font-heading text-base font-bold tracking-tight text-brand-dark">
              {{ tenant?.name || 'Partner' }}
            </p>
            <p class="font-mono text-[11px] text-muted">
              {{ tenant?.slug }}<span v-if="tenant?.id"> · #{{ tenant.id }}</span>
            </p>
          </div>
          <button type="button" class="shrink-0 text-muted transition hover:text-brand" aria-label="Close" @click="emit('close')">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div class="flex shrink-0 gap-1 border-b border-brand/10 px-3 py-2">
          <button
            v-for="t in [
              { id: 'profile', label: 'Profile' },
              { id: 'orders', label: 'Orders' },
              { id: 'audit', label: 'History' },
            ]"
            :key="t.id"
            type="button"
            class="rounded-lg px-3 py-1.5 text-xs font-bold transition"
            :class="tab === t.id ? 'bg-brand/10 text-brand' : 'text-ink/50 hover:bg-brand/5'"
            @click="tab = t.id"
          >
            {{ t.label }}
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p v-if="error" class="rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{{ error }}</p>

          <div v-else-if="loading" class="py-10 text-center text-xs text-muted">Loading…</div>

          <!-- Profile & lifecycle -->
          <div v-else-if="tab === 'profile' && tenant" class="space-y-5">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold"
                :class="tenantStatusMeta(tenant.status).cls"
              >
                {{ tenantStatusMeta(tenant.status).label }}
              </span>
              <span class="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700">
                {{ tenant.account_type?.name || 'No tier' }}
              </span>
              <span v-if="tenant.wallet" class="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
                {{ money(tenant.wallet.balance_minor) }} held
              </span>
            </div>

            <dl class="grid grid-cols-2 gap-3">
              <div class="clay-sm rounded-xl bg-bg p-3">
                <dt class="text-[10px] font-bold tracking-widest text-muted uppercase">Email</dt>
                <dd class="mt-0.5 truncate text-xs font-semibold text-brand-dark">{{ tenant.email }}</dd>
              </div>
              <div class="clay-sm rounded-xl bg-bg p-3">
                <dt class="text-[10px] font-bold tracking-widest text-muted uppercase">Phone</dt>
                <dd class="mt-0.5 text-xs font-semibold text-brand-dark">{{ tenant.phone || '—' }}</dd>
              </div>
              <div class="clay-sm rounded-xl bg-bg p-3">
                <dt class="text-[10px] font-bold tracking-widest text-muted uppercase">Min top-up</dt>
                <dd class="mt-0.5 text-xs font-semibold text-brand-dark">{{ money(tenant.min_topup_minor) }}</dd>
              </div>
              <div class="clay-sm rounded-xl bg-bg p-3">
                <dt class="text-[10px] font-bold tracking-widest text-muted uppercase">Failed-order refunds</dt>
                <dd class="mt-0.5 text-xs font-semibold text-brand-dark">
                  {{ tenant.auto_refund_on_failure ? `Auto after ${tenant.auto_refund_after_minutes}m` : 'Manual' }}
                </dd>
              </div>
              <div class="clay-sm rounded-xl bg-bg p-3">
                <dt class="text-[10px] font-bold tracking-widest text-muted uppercase">Created</dt>
                <dd class="mt-0.5 text-xs font-semibold text-brand-dark">{{ formatDateTime(tenant.created_at) }}</dd>
              </div>
              <div class="clay-sm rounded-xl bg-bg p-3">
                <dt class="text-[10px] font-bold tracking-widest text-muted uppercase">Orders today</dt>
                <dd class="mt-0.5 text-xs font-semibold text-brand-dark">{{ tenant.orders_today ?? '—' }}</dd>
              </div>
            </dl>

            <!-- Lifecycle: the audited actions live behind these buttons, not behind
                 a generic "save" that would record nothing. -->
            <section class="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
              <h3 class="font-heading text-xs font-bold tracking-tight text-amber-900">Access</h3>
              <p class="mt-0.5 text-[11px] text-amber-800/80">
                Both actions are written to this partner's history with your name attached.
              </p>
              <div class="mt-3 flex gap-2">
                <button
                  v-if="tenant.status === 'active'"
                  type="button"
                  :disabled="busy"
                  class="rounded-xl bg-amber-500 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-amber-600 disabled:opacity-60"
                  @click="suspend"
                >
                  Suspend partner
                </button>
                <button
                  v-else-if="tenant.status === 'suspended'"
                  type="button"
                  :disabled="busy"
                  class="rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                  @click="activate"
                >
                  Reactivate
                </button>
                <span v-else class="text-[11px] font-semibold text-slate-500">
                  This partner is closed. Their history stays readable.
                </span>
              </div>
            </section>

            <!-- Tier: price changes are why this is audited, and the reason is a
                 required field on the backend rather than a suggestion here. -->
            <section class="rounded-2xl border border-sky-200 bg-sky-50/50 p-4">
              <h3 class="font-heading text-xs font-bold tracking-tight text-sky-900">Tier</h3>
              <p class="mt-0.5 text-[11px] text-sky-800/80">
                Changing tier changes what they pay for every package from the next order on.
                Their balance is untouched.
              </p>
              <div class="mt-3 grid gap-2 sm:grid-cols-[1fr_1.4fr]">
                <select
                  v-model="nextTierId"
                  class="clay-well rounded-xl bg-surface px-3 py-2 text-xs font-semibold text-brand-dark outline-none"
                >
                  <option v-for="t in tiers" :key="t.id" :value="t.id">{{ t.name }}</option>
                </select>
                <input
                  v-model="tierReason"
                  type="text"
                  placeholder="Reason for the record"
                  class="clay-well rounded-xl bg-surface px-3 py-2 text-xs text-brand-dark outline-none"
                />
              </div>
              <button
                type="button"
                :disabled="busy || Number(nextTierId) === Number(tenant.account_type?.id)"
                class="mt-2 rounded-xl bg-sky-600 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                @click="saveTier"
              >
                {{ changingTier ? 'Saving…' : 'Change tier' }}
              </button>
            </section>

            <p class="text-[11px] text-muted">
              Wallet, API keys and settlements have their own tabs — pick this partner from
              those screens to work on them.
            </p>
          </div>

          <!-- Orders -->
          <div v-else-if="tab === 'orders'">
            <div class="overflow-hidden rounded-xl border border-brand/10">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="border-b border-brand/10 bg-bg/60 text-[10px] font-extrabold tracking-widest text-muted uppercase">
                    <th class="px-3 py-2.5">Reference</th>
                    <th class="px-3 py-2.5">Network</th>
                    <th class="px-3 py-2.5 text-right">Amount</th>
                    <th class="px-3 py-2.5">Status</th>
                    <th class="px-3 py-2.5 text-right">Created</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="o in orders" :key="o.id" class="border-b border-brand/5 last:border-0">
                    <td class="px-3 py-2.5 font-mono text-[11px] font-semibold text-brand-dark">{{ o.reference }}</td>
                    <td class="px-3 py-2.5 text-muted">{{ o.network }}</td>
                    <td class="px-3 py-2.5 text-right font-semibold">{{ money(o.amount_minor) }}</td>
                    <td class="px-3 py-2.5">
                      <span class="text-[10px] font-extrabold" :class="o.status === 'success' ? 'text-emerald-600' : o.status === 'failed' ? 'text-red-600' : 'text-amber-600'">
                        {{ o.status }}
                      </span>
                    </td>
                    <td class="px-3 py-2.5 text-right text-[11px] text-muted">{{ formatDateTime(o.created_at) }}</td>
                  </tr>
                  <tr v-if="!orders.length">
                    <td colspan="5" class="px-3 py-8 text-center text-xs text-muted">No orders yet.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Pagination v-model:page="orderPage" :total-pages="orderMeta.last_page" :total="orderMeta.total" />
          </div>

          <!-- History -->
          <div v-else-if="tab === 'audit'">
            <p class="mb-2 text-[11px] text-muted">
              Append-only. Every access change, key issue and wallet movement, in order.
            </p>
            <ol class="space-y-2">
              <li v-for="entry in audit" :key="entry.id" class="clay-sm rounded-xl bg-bg p-3">
                <div class="flex items-center justify-between gap-2">
                  <span class="rounded-full px-2 py-0.5 text-[10px] font-extrabold" :class="auditMeta(entry.action).cls">
                    {{ auditMeta(entry.action).label }}
                  </span>
                  <span class="text-[10px] text-muted">{{ formatDateTime(entry.created_at) }}</span>
                </div>
                <p v-if="entry.reason" class="mt-1.5 text-xs font-medium text-brand-dark">{{ entry.reason }}</p>
                <p class="mt-1 text-[10px] text-muted">by {{ entry.actor }}</p>
              </li>
              <li v-if="!audit.length" class="py-8 text-center text-xs text-muted">Nothing recorded yet.</li>
            </ol>
            <Pagination v-model:page="auditPage" :total-pages="auditPages.last_page" :total="auditPages.total" />
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
