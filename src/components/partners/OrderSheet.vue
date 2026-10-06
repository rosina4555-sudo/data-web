<script setup>
/**
 * One partner order, read-only.
 *
 * Mirrors admin/OrderDetailSheet.vue's sections — payments, timeline, fulfilment
 * attempts, refunds — and deliberately not its actions. Every override there
 * (refresh status, resubmit, force a status, cancel a refund) is a retail
 * endpoint called with the retail token; this console has its own session and
 * its own scope, and a partner's order is watched here, not steered.
 *
 * The detail comes from the tenant-scoped route, so an order belonging to
 * another partner cannot be loaded here even with a valid id.
 */
import { ref, computed, watch } from 'vue'
import { partnerApi } from '../../services/partnerApi'
import { money } from '../../utils/partners'
import { formatDateTime, refundMeta, timeAgo } from '../../utils/format'

const props = defineProps({
  tenantId: { type: Number, required: true },
  orderId: { type: Number, required: true },
})
const emit = defineEmits(['close'])

const order = ref(null)
const loading = ref(true)
const error = ref('')

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await partnerApi.getTenantOrder(props.tenantId, props.orderId)
    order.value = res.data || res
  } catch (err) {
    error.value = err?.message || 'Could not load this order.'
  } finally {
    loading.value = false
  }
}

watch(() => props.orderId, load, { immediate: true })

// The detail endpoint hands back money as decimal major units, while the
// console formats from minor units. Round at the boundary rather than
// truncating: 0.29 * 100 is 28.999... in a float, and Math.trunc would show a
// cedi short of what was actually charged.
const toMinor = (value) => Math.round(Number(value || 0) * 100)

const statusClass = (status) => {
  if (status === 'SUCCESS') return 'bg-emerald-50 text-emerald-700'
  if (status === 'FAILED') return 'bg-red-50 text-red-600'
  if (status === 'REFUNDED') return 'bg-indigo-50 text-indigo-700'
  return 'bg-amber-50 text-amber-700'
}

const timelineRev = computed(() => [...(order.value?.timeline || [])].reverse())
const attemptsRev = computed(() => [...(order.value?.attempts || [])].reverse())
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[60] flex justify-end bg-brand-dark/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      @click.self="emit('close')"
    >
      <div class="clay flex h-full w-full flex-col overflow-hidden rounded-l-3xl bg-surface sm:max-w-xl">
        <div class="flex shrink-0 items-start justify-between gap-3 border-b border-brand/10 px-5 py-4">
          <div class="min-w-0">
            <p class="truncate font-mono text-sm font-bold text-brand-dark">{{ order?.reference || 'Order' }}</p>
            <p v-if="order" class="mt-0.5 text-[11px] text-muted">
              {{ order.package }} · {{ order.network }} · {{ formatDateTime(order.created_at) }}
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <span
              v-if="order"
              class="rounded-full px-2.5 py-1 text-[10px] font-extrabold"
              :class="statusClass(order.status)"
            >
              {{ order.status }}
            </span>
            <button type="button" class="text-muted transition hover:text-brand" aria-label="Close" @click="emit('close')">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p v-if="error" class="rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{{ error }}</p>
          <div v-else-if="loading" class="py-10 text-center text-xs text-muted">Loading…</div>

          <template v-else-if="order">
            <div class="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              <div class="clay rounded-2xl bg-bg p-3">
                <p class="font-bold tracking-widest text-muted uppercase">Amount</p>
                <p class="mt-0.5 font-heading font-black text-brand">{{ money(toMinor(order.amount)) }}</p>
              </div>
              <div class="clay rounded-2xl bg-bg p-3">
                <p class="font-bold tracking-widest text-muted uppercase">Phone</p>
                <p class="mt-0.5 font-semibold text-brand-dark">{{ order.phone }}</p>
              </div>
              <div class="clay rounded-2xl bg-bg p-3">
                <p class="font-bold tracking-widest text-muted uppercase">Provider</p>
                <p class="mt-0.5 font-semibold text-brand-dark">{{ order.provider || '—' }}</p>
              </div>
            </div>

            <div
              v-if="order.provider_status || order.provider_reference || order.payment_ref"
              class="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3"
            >
              <div v-if="order.provider_status" class="clay rounded-2xl bg-bg p-3">
                <p class="font-bold tracking-widest text-muted uppercase">Provider status</p>
                <p class="mt-1 font-semibold text-brand-dark">{{ order.provider_status }}</p>
              </div>
              <div v-if="order.provider_reference" class="clay rounded-2xl bg-bg p-3">
                <p class="font-bold tracking-widest text-muted uppercase">Provider ref</p>
                <p class="mt-1 font-mono truncate font-semibold text-brand-dark">{{ order.provider_reference }}</p>
              </div>
              <div v-if="order.payment_ref" class="clay rounded-2xl bg-bg p-3">
                <p class="font-bold tracking-widest text-muted uppercase">Payment ref</p>
                <p class="mt-1 font-mono truncate font-semibold text-brand-dark">{{ order.payment_ref }}</p>
              </div>
            </div>

            <div v-if="order.payments?.length" class="mt-4">
              <h3 class="font-heading mb-2 text-xs font-bold tracking-widest text-muted uppercase">Payments</h3>
              <ul class="space-y-2">
                <li v-for="(p, i) in order.payments" :key="i" class="clay flex items-center justify-between gap-3 rounded-2xl bg-bg px-3.5 py-2.5 text-xs">
                  <div class="min-w-0">
                    <p class="font-mono truncate font-semibold text-brand-dark">{{ p.paystack_reference }}</p>
                    <p class="text-[10px] text-muted">{{ p.channel || '—' }} · {{ formatDateTime(p.paid_at) }}</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="font-black text-brand">{{ money(toMinor(p.amount)) }}</span>
                    <span
                      class="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                      :class="p.status === 'success' ? 'bg-emerald-50 text-emerald-700' : p.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'"
                    >
                      {{ p.status }}
                    </span>
                  </div>
                </li>
              </ul>
            </div>

            <div class="mt-4">
              <h3 class="font-heading mb-2 text-xs font-bold tracking-widest text-muted uppercase">Timeline</h3>
              <ol class="space-y-0">
                <li v-for="(t, i) in timelineRev" :key="i" class="relative flex gap-3 pb-3 last:pb-0">
                  <div class="flex flex-col items-center">
                    <span class="mt-1 h-2.5 w-2.5 rounded-full border-2 border-brand bg-brand-soft"></span>
                    <span v-if="i < timelineRev.length - 1" class="h-full w-px bg-brand/15"></span>
                  </div>
                  <div class="min-w-0 pb-1">
                    <p class="text-xs">
                      <span class="font-bold text-brand-dark">{{ t.from }}</span> →
                      <span class="font-bold text-brand">{{ t.to }}</span>
                    </p>
                    <p v-if="t.note" class="mt-0.5 font-medium text-muted">{{ t.note }}</p>
                    <p class="mt-0.5 text-[10px] text-muted/70">{{ t.actor }} · {{ timeAgo(t.at) }}</p>
                  </div>
                </li>
                <li v-if="!timelineRev.length" class="text-xs text-muted">No status changes recorded.</li>
              </ol>
            </div>

            <div v-if="attemptsRev.length" class="mt-4">
              <h3 class="font-heading mb-2 text-xs font-bold tracking-widest text-muted uppercase">Fulfilment attempts</h3>
              <ul class="space-y-2">
                <li v-for="(a, i) in attemptsRev" :key="i" class="clay rounded-2xl bg-bg px-3.5 py-2.5 text-xs">
                  <div class="flex items-center justify-between gap-2">
                    <p class="font-bold text-brand-dark capitalize">{{ a.action }} #{{ a.attempt_no }}</p>
                    <span
                      class="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                      :class="a.status === 'success' ? 'bg-emerald-50 text-emerald-700' : a.status === 'error' || a.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'"
                    >
                      {{ a.status }}
                    </span>
                  </div>
                  <p v-if="a.error" class="mt-1 font-medium text-muted break-words">{{ a.error }}</p>
                  <p class="mt-0.5 text-[10px] text-muted/70">{{ timeAgo(a.at) }}</p>
                </li>
              </ul>
            </div>

            <div v-if="order.refunds?.length" class="mt-4">
              <h3 class="font-heading mb-2 text-xs font-bold tracking-widest text-muted uppercase">Refunds</h3>
              <ul class="space-y-2">
                <li v-for="r in order.refunds" :key="r.id" class="clay rounded-2xl bg-bg px-3.5 py-2.5 text-xs">
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex min-w-0 items-center gap-2">
                      <span class="font-black text-brand">{{ money(toMinor(r.amount)) }}</span>
                      <span class="rounded-full px-2 py-0.5 text-[10px] font-extrabold whitespace-nowrap" :class="refundMeta(r.status).cls">
                        {{ refundMeta(r.status).label }}
                      </span>
                    </div>
                  </div>
                  <p v-if="r.reason" class="mt-1 font-medium text-muted break-words">{{ r.reason }}</p>
                  <p v-if="r.error" class="mt-1 font-medium text-red-600 break-words">{{ r.error }}</p>
                  <p class="mt-0.5 text-[10px] text-muted/70">
                    initiated {{ timeAgo(r.initiated_at) }}
                    <template v-if="r.refunded_at"> · refunded {{ timeAgo(r.refunded_at) }}</template>
                    <template v-if="r.cancelled_at"> · cancelled {{ timeAgo(r.cancelled_at) }} <span v-if="r.cancelled_by">by {{ r.cancelled_by }}</span></template>
                  </p>
                </li>
              </ul>
            </div>

            <p class="mt-5 border-t border-brand/10 pt-3 text-[11px] text-muted">
              Read-only. Refunds and status overrides for this order are worked from the
              main admin console, where the refund queue lives.
            </p>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>
