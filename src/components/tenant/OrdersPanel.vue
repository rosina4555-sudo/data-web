<script setup>
/**
 * Orders this account has placed, newest first.
 *
 * The list is capped rather than paged: a partner orders in bursts, and 200
 * rows behind one status filter answers "what happened to X" faster than a
 * pager does. Anything older than that is history, and support can pull it.
 *
 * The detail sheet reads one reference at a time and refuses to show anything
 * about the upstream supplier or our list price — the partner sees what it was
 * charged, which is what it reconciles against, and not our margin.
 */
import { ref, onMounted } from 'vue'
import { tenantApi } from '../../services/tenantApi'
import { toast } from '../../services/toast'
import { formatDateTime, statusMeta } from '../../utils/format'
import LoadError from '../LoadError.vue'

const STATUSES = [
  { id: '', label: 'All statuses' },
  { id: 'PAID', label: 'Paid' },
  { id: 'SUBMITTED', label: 'Delivering' },
  { id: 'SUCCESS', label: 'Delivered' },
  { id: 'FAILED', label: 'Failed' },
  { id: 'REFUNDED', label: 'Refunded' },
]

const orders = ref([])
const status = ref('')
const loading = ref(false)
const error = ref('')

const detail = ref(null)
const detailLoading = ref(false)
const detailError = ref('')

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await tenantApi.getOrders({ status: status.value || undefined, limit: 200 })
    orders.value = res.data
  } catch (err) {
    orders.value = []
    error.value = err?.message || 'Could not load your orders.'
  } finally {
    loading.value = false
  }
}

const changeStatus = (value) => {
  status.value = value
  load()
}

const open = async (order) => {
  detailLoading.value = true
  detailError.value = ''
  detail.value = null
  try {
    detail.value = (await tenantApi.getOrder(order.reference)).data
  } catch (err) {
    detailError.value = err?.message || 'Could not load that order.'
  } finally {
    detailLoading.value = false
  }
}

const close = () => {
  detail.value = null
  detailError.value = ''
}

const copyRef = async (ref_) => {
  try {
    await navigator.clipboard.writeText(ref_)
    toast('Reference copied', 'success')
  } catch {
    toast('Copy failed — select the reference and copy it manually.', 'error')
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <div class="clay flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-surface p-4 sm:p-5">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Orders</h1>
        <p class="mt-0.5 text-xs text-muted">Everything you have bought, and where each one got to.</p>
      </div>
      <label class="block">
        <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Status</span>
        <select
          :value="status"
          class="clay-well rounded-xl bg-bg px-3 py-2 text-xs font-bold outline-none"
          @change="changeStatus($event.target.value)"
        >
          <option v-for="s in STATUSES" :key="s.id" :value="s.id">{{ s.label }}</option>
        </select>
      </label>
    </div>

    <LoadError :error="error" :busy="loading" @retry="load" />

    <p v-if="loading" class="clay rounded-2xl bg-surface py-10 text-center text-xs text-muted">Loading orders…</p>

    <p v-else-if="!orders.length" class="clay rounded-2xl bg-surface py-10 text-center text-xs text-muted">
      {{ status ? 'No orders with that status.' : 'No orders yet — buy your first bundle on the Buy data tab.' }}
    </p>

    <template v-else>
      <!-- Desktop table -->
      <div class="clay hidden overflow-hidden rounded-2xl bg-surface lg:block">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-brand/10 bg-bg/60 text-[10px] font-extrabold tracking-widest text-muted uppercase">
                <th class="px-4 py-3">Reference</th>
                <th class="px-4 py-3">Number</th>
                <th class="px-4 py-3 text-right">Charged</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3">Placed</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="o in orders"
                :key="o.reference"
                class="cursor-pointer border-b border-brand/5 transition last:border-0 hover:bg-brand/[0.03]"
                @click="open(o)"
              >
                <td class="px-4 py-3 font-mono text-[11px] font-semibold text-brand-dark">{{ o.reference }}</td>
                <td class="px-4 py-3 text-ink/70">{{ o.customer_phone }}</td>
                <td class="px-4 py-3 text-right font-bold text-brand-dark">{{ o.amount }}</td>
                <td class="px-4 py-3">
                  <span
                    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold"
                    :class="statusMeta(o.status).cls"
                  >
                    <span class="h-1.5 w-1.5 rounded-full bg-current opacity-70"></span>
                    {{ statusMeta(o.status).label }}
                  </span>
                </td>
                <td class="px-4 py-3 text-[11px] text-muted">{{ formatDateTime(o.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mobile cards -->
      <ul class="space-y-3 lg:hidden">
        <li
          v-for="o in orders"
          :key="o.reference"
          class="clay rounded-2xl bg-surface p-4"
          @click="open(o)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate font-mono text-[11px] font-semibold text-brand-dark">{{ o.reference }}</p>
              <p class="mt-0.5 truncate text-xs text-muted">{{ o.customer_phone }} · {{ formatDateTime(o.created_at) }}</p>
            </div>
            <div class="shrink-0 text-right">
              <p class="font-heading text-sm font-black text-brand-dark">{{ o.amount }}</p>
              <span
                class="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                :class="statusMeta(o.status).cls"
              >{{ statusMeta(o.status).label }}</span>
            </div>
          </div>
        </li>
      </ul>

      <p class="text-center text-[11px] text-muted">{{ orders.length }} shown</p>
    </template>

    <!-- Order detail -->
    <Teleport to="body">
      <div
        v-if="detailLoading || detailError || detail"
        class="fixed inset-0 z-50 flex items-end justify-center bg-brand-dark/60 p-4 backdrop-blur-sm sm:items-center"
        role="dialog"
        aria-modal="true"
        @click.self="close"
      >
        <div class="clay max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl bg-surface p-6">
          <p v-if="detailLoading" class="py-8 text-center text-xs text-muted">Loading order…</p>

          <template v-else-if="detailError">
            <p class="text-xs font-semibold text-red-600">{{ detailError }}</p>
            <button
              type="button"
              class="mt-4 w-full rounded-xl border border-brand/20 px-4 py-2.5 text-xs font-bold text-brand transition hover:bg-brand-soft"
              @click="close"
            >Close</button>
          </template>

          <template v-else>
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-[10px] font-extrabold tracking-widest text-muted uppercase">Order</p>
                <button
                  type="button"
                  class="mt-1 block truncate font-mono text-sm font-bold text-brand-dark transition hover:text-brand"
                  title="Copy reference"
                  @click="copyRef(detail.reference)"
                >{{ detail.reference }} ⧉</button>
              </div>
              <span
                class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold"
                :class="statusMeta(detail.status).cls"
              >{{ statusMeta(detail.status).label }}</span>
            </div>

            <dl class="mt-4 space-y-2.5 text-xs">
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted">Number</dt>
                <dd class="font-bold text-brand-dark">{{ detail.customer_phone }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted">Charged</dt>
                <dd class="font-heading text-base font-black text-brand">{{ detail.amount }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted">Package</dt>
                <dd class="font-mono text-[11px] text-ink/70">#{{ detail.package_id }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted">Paid with</dt>
                <dd class="font-bold text-brand-dark">{{ detail.payment_source || 'wallet' }}</dd>
              </div>
              <div v-if="detail.provider_status" class="flex items-center justify-between gap-3">
                <dt class="text-muted">Carrier says</dt>
                <dd class="font-mono text-[11px] text-ink/70">{{ detail.provider_status }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted">Placed</dt>
                <dd class="text-ink/70">{{ formatDateTime(detail.created_at) }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted">Updated</dt>
                <dd class="text-ink/70">{{ formatDateTime(detail.updated_at) }}</dd>
              </div>
            </dl>

            <p class="mt-4 rounded-xl bg-brand/5 px-3.5 py-2.5 text-[11px] text-muted">
              If a delivery fails the order is refunded to your wallet — check the Wallet tab to
              see the credit land.
            </p>

            <button
              type="button"
              class="mt-4 w-full rounded-xl border border-brand/20 px-4 py-2.5 text-xs font-bold text-brand transition hover:bg-brand-soft"
              @click="close"
            >Close</button>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>
