<script setup>
import { ref, computed, onMounted } from 'vue'
import { adminApi } from '../../services/api'
import { currency, formatDateTime, refundMeta, timeAgo } from '../../utils/format'
import { toast } from '../../services/toast'
import StatusPill from '../StatusPill.vue'

const props = defineProps({
  orderId: { type: Number, required: true },
})
const emit = defineEmits(['close', 'updated'])

const loading = ref(true)
const order = ref(null)
const acting = ref(false)
const error = ref('')

const ALL_STATUSES = ['PENDING_PAYMENT', 'PAID', 'SUBMITTED', 'SUCCESS', 'FAILED', 'SUPERVISED', 'EXPIRED']
const override = ref({ status: '', note: '' })

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await adminApi.getOrder(props.orderId)
    order.value = res.data || res
  } catch (err) {
    error.value = err?.message || 'Failed to load order.'
    toast(error.value, 'error')
  } finally {
    loading.value = false
  }
}
onMounted(load)

const refreshStatus = async () => {
  acting.value = true
  try {
    await adminApi.refreshStatus(props.orderId)
    toast('Status refreshed.', 'success')
    await load()
    emit('updated')
  } catch (err) {
    toast(err?.message || 'Refresh failed.', 'error')
  } finally {
    acting.value = false
  }
}

const retry = async () => {
  acting.value = true
  try {
    await adminApi.retry(props.orderId)
    toast('Resubmission started.', 'success')
    await load()
    emit('updated')
  } catch (err) {
    toast(err?.message || 'Retry failed.', 'error')
  } finally {
    acting.value = false
  }
}

const cancelRefund = async (refundId) => {
  if (!window.confirm('Cancel this refund? The customer has not been paid yet, and the order becomes retryable again.')) return
  acting.value = true
  try {
    await adminApi.cancelRefund(refundId)
    toast('Refund cancelled.', 'success')
    await load()
    emit('updated')
  } catch (err) {
    toast(err?.message || 'Could not cancel refund.', 'error')
  } finally {
    acting.value = false
  }
}

const activeRefund = computed(() =>
  order.value?.refunds?.find((r) => ['pending', 'processing', 'refunded'].includes(r.status)) || null,
)
const canRefresh = computed(() => order.value?.status === 'SUBMITTED')
const canRetry = computed(() =>
  ['PAID', 'FAILED', 'SUPERVISED'].includes(order.value?.status) && !activeRefund.value,
)
const canOverride = computed(() => {
  if (!order.value) return false
  const s = override.value.status
  return ALL_STATUSES.includes(s) && s !== order.value.status
})

const submitOverride = async () => {
  if (!canOverride.value) return
  acting.value = true
  try {
    await adminApi.changeStatus(props.orderId, override.value.status, override.value.note.trim())
    toast(`Status set to ${override.value.status}.`, 'success')
    override.value = { status: '', note: '' }
    await load()
    emit('updated')
  } catch (err) {
    toast(err?.message || 'Could not change status.', 'error')
  } finally {
    acting.value = false
  }
}

const timelineRev = computed(() =>
  order.value?.timeline ? [...order.value.timeline].reverse() : [],
)
const attemptsRev = computed(() =>
  order.value?.attempts ? [...order.value.attempts].reverse() : [],
)
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-end justify-center bg-brand-dark/45 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" @click.self="emit('close')">
      <div class="clay flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface sm:max-w-2xl sm:rounded-3xl">
        <!-- Header -->
        <div class="flex shrink-0 items-center justify-between border-b border-brand/10 px-5 py-4">
          <div class="flex min-w-0 items-center gap-2.5">
            <p class="font-mono truncate text-sm font-bold text-brand-dark">{{ order?.reference || `#${orderId}` }}</p>
            <StatusPill v-if="order" :status="order.status" small />
          </div>
          <button type="button" aria-label="Close" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-brand/5 hover:text-brand" @click="emit('close')">✕</button>
        </div>

        <div class="hide-scrollbar flex-1 overflow-y-auto px-5 py-4">
          <div v-if="loading" class="flex items-center justify-center py-16">
            <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand/15 border-t-brand"></div>
          </div>

          <div v-else-if="error" class="py-10 text-center text-sm font-semibold text-red-600">{{ error }}</div>

          <template v-else-if="order">
            <!-- Summary card -->
            <div class="clay-well rounded-2xl bg-bg p-4">
              <div class="grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-3">
                <div>
                  <p class="font-bold tracking-widest text-muted uppercase">Bundle</p>
                  <p class="mt-0.5 font-bold text-brand-dark">{{ order.package }}</p>
                </div>
                <div>
                  <p class="font-bold tracking-widest text-muted uppercase">Network</p>
                  <p class="mt-0.5 font-bold text-brand-dark">{{ order.network || '—' }}</p>
                </div>
                <div>
                  <p class="font-bold tracking-widest text-muted uppercase">Amount</p>
                  <p class="mt-0.5 font-heading font-black text-brand">{{ currency(order.amount) }}</p>
                </div>
                <div>
                  <p class="font-bold tracking-widest text-muted uppercase">Phone</p>
                  <p class="mt-0.5 font-semibold text-brand-dark">{{ order.phone }}</p>
                </div>
                <div>
                  <p class="font-bold tracking-widest text-muted uppercase">Provider</p>
                  <p class="mt-0.5 font-semibold text-brand-dark">{{ order.provider || '—' }}</p>
                </div>
                <div>
                  <p class="font-bold tracking-widest text-muted uppercase">Created</p>
                  <p class="mt-0.5 font-medium text-brand-dark">{{ formatDateTime(order.created_at) }}</p>
                </div>
              </div>
            </div>

            <!-- Provider meta -->
            <div v-if="order.provider_status || order.provider_reference || order.payment_ref" class="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              <div v-if="order.provider_status" class="clay rounded-2xl bg-surface p-3">
                <p class="font-bold tracking-widest text-muted uppercase">Provider status</p>
                <p class="mt-1 font-semibold text-brand-dark">{{ order.provider_status }}</p>
              </div>
              <div v-if="order.provider_reference" class="clay rounded-2xl bg-surface p-3">
                <p class="font-bold tracking-widest text-muted uppercase">Provider ref</p>
                <p class="mt-1 font-mono truncate font-semibold text-brand-dark">{{ order.provider_reference }}</p>
              </div>
              <div v-if="order.payment_ref" class="clay rounded-2xl bg-surface p-3">
                <p class="font-bold tracking-widest text-muted uppercase">Payment ref</p>
                <p class="mt-1 font-mono truncate font-semibold text-brand-dark">{{ order.payment_ref }}</p>
              </div>
            </div>

            <!-- Payments -->
            <div v-if="order.payments?.length" class="mt-4">
              <h3 class="font-heading mb-2 text-xs font-bold tracking-widest text-muted uppercase">Payments</h3>
              <ul class="space-y-2">
                <li v-for="(p, i) in order.payments" :key="i" class="clay flex items-center justify-between gap-3 rounded-2xl bg-surface px-3.5 py-2.5 text-xs">
                  <div class="min-w-0">
                    <p class="font-mono truncate font-semibold text-brand-dark">{{ p.paystack_reference }}</p>
                    <p class="text-[10px] text-muted">{{ p.channel || '—' }} · {{ formatDateTime(p.paid_at) }}</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="font-black text-brand">{{ currency(p.amount) }}</span>
                    <span class="rounded-full px-2 py-0.5 text-[10px] font-extrabold" :class="p.status === 'success' ? 'bg-emerald-50 text-emerald-700' : p.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-accent-soft text-accent-dark'">{{ p.status }}</span>
                  </div>
                </li>
              </ul>
            </div>

            <!-- Timeline -->
            <div class="mt-4">
              <h3 class="font-heading mb-2 text-xs font-bold tracking-widest text-muted uppercase">Timeline</h3>
              <ol class="space-y-0">
                <li v-for="(t, i) in timelineRev" :key="i" class="relative flex gap-3 pb-3 pl-0 last:pb-0">
                  <div class="flex flex-col items-center">
                    <span class="mt-1 h-2.5 w-2.5 rounded-full border-2 border-brand bg-brand-soft"></span>
                    <span v-if="i < timelineRev.length - 1" class="h-full w-px bg-brand/15"></span>
                  </div>
                  <div class="min-w-0 pb-1">
                    <p class="text-xs"><span class="font-bold text-brand-dark">{{ t.from }}</span> → <span class="font-bold text-brand">{{ t.to }}</span></p>
                    <p v-if="t.note" class="mt-0.5 font-medium text-muted">{{ t.note }}</p>
                    <p class="mt-0.5 text-[10px] text-muted/70">{{ t.actor }} · {{ timeAgo(t.at) }}</p>
                  </div>
                </li>
              </ol>
            </div>

            <!-- Attempts -->
            <div v-if="attemptsRev.length" class="mt-4">
              <h3 class="font-heading mb-2 text-xs font-bold tracking-widest text-muted uppercase">Fulfilment attempts</h3>
              <ul class="space-y-2">
                <li v-for="(a, i) in attemptsRev" :key="i" class="clay rounded-2xl bg-surface px-3.5 py-2.5 text-xs">
                  <div class="flex items-center justify-between gap-2">
                    <p class="font-bold text-brand-dark capitalize">{{ a.action }} #{{ a.attempt_no }}</p>
                    <span class="rounded-full px-2 py-0.5 text-[10px] font-extrabold" :class="a.status === 'success' ? 'bg-emerald-50 text-emerald-700' : a.status === 'rejected' ? 'bg-red-50 text-red-600' : a.status === 'error' ? 'bg-accent-soft text-accent-dark' : 'bg-slate-100 text-slate-500'">{{ a.status }}</span>
                  </div>
                  <p v-if="a.error" class="mt-1 font-medium text-muted break-words">{{ a.error }}</p>
                  <p class="mt-0.5 text-[10px] text-muted/70">{{ timeAgo(a.at) }}</p>
                </li>
              </ul>
            </div>

            <!-- Refunds -->
            <div v-if="order.refunds?.length" class="mt-4">
              <h3 class="font-heading mb-2 text-xs font-bold tracking-widest text-muted uppercase">Refunds</h3>
              <ul class="space-y-2">
                <li v-for="r in order.refunds" :key="r.id" class="clay rounded-2xl bg-surface px-3.5 py-2.5 text-xs">
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex min-w-0 items-center gap-2">
                      <span class="font-black text-brand">{{ currency(r.amount) }}</span>
                      <span class="rounded-full px-2 py-0.5 text-[10px] font-extrabold whitespace-nowrap" :class="refundMeta(r.status).cls">{{ refundMeta(r.status).label }}</span>
                    </div>
                    <button
                      v-if="['pending', 'processing'].includes(r.status)"
                      type="button"
                      class="rounded-xl bg-red-50 px-3 py-1.5 text-[11px] font-extrabold text-red-600 transition hover:bg-red-100 disabled:opacity-40"
                      :disabled="acting"
                      @click="cancelRefund(r.id)"
                    >
                      Cancel refund
                    </button>
                  </div>
                  <p v-if="r.reason" class="mt-1 font-medium text-muted break-words">{{ r.reason }}</p>
                  <p class="mt-0.5 text-[10px] text-muted/70">
                    initiated {{ timeAgo(r.initiated_at) }}
                    <template v-if="r.refunded_at"> · refunded {{ timeAgo(r.refunded_at) }}</template>
                    <template v-if="r.cancelled_at"> · cancelled {{ timeAgo(r.cancelled_at) }} <span v-if="r.cancelled_by">by {{ r.cancelled_by }}</span></template>
                  </p>
                </li>
              </ul>
            </div>

            <!-- Actions -->
            <div class="mt-5 border-t border-brand/10 pt-4">
              <div class="flex flex-wrap gap-2">
                <button type="button" :disabled="!canRefresh || acting" class="clay-btn-light rounded-xl bg-surface px-3.5 py-2 text-xs font-extrabold text-brand transition disabled:opacity-40" @click="refreshStatus">
                  ↻ Refresh status
                </button>
                <button type="button" :disabled="!canRetry || acting" class="clay-btn rounded-xl bg-gradient-to-r from-brand to-brand-dark px-3.5 py-2 text-xs font-extrabold text-white transition disabled:opacity-40" @click="retry">
                  Retry submission
                </button>
              </div>
              <p v-if="activeRefund" class="mt-2 text-[11px] font-semibold text-amber-700">Retry is disabled — a refund is {{ activeRefund.status === 'refunded' ? 'settled' : 'being processed' }} for this order. Cancel it first to retry.</p>
              <p v-if="order.status === 'SUPERVISED' && !activeRefund" class="mt-2 text-[11px] font-medium text-muted">You can retry this order or refund the customer from the Refunds tab.</p>

              <div class="mt-4 rounded-2xl bg-bg p-4">
                <p class="text-xs font-bold tracking-widest text-muted uppercase">Override status <span class="font-medium normal-case text-muted/70">(state-machine enforced)</span></p>
                <div class="mt-2.5 flex flex-col gap-2 sm:flex-row">
                  <select v-model="override.status" class="clay-well flex-1 rounded-xl bg-surface px-3 py-2 text-xs font-semibold text-brand-dark outline-none">
                    <option value="" disabled>Choose target status…</option>
                    <option v-for="s in ALL_STATUSES" :key="s" :value="s">{{ s }}</option>
                  </select>
                  <input v-model="override.note" type="text" placeholder="Reason / note (required by admin)" class="clay-well flex-[2] rounded-xl bg-surface px-3 py-2 text-xs font-medium text-brand-dark outline-none placeholder:text-muted/40" />
                  <button type="button" :disabled="!canOverride || acting" class="clay-btn rounded-xl bg-gradient-to-r from-accent to-accent-dark px-4 py-2 text-xs font-extrabold text-white transition disabled:opacity-40" @click="submitOverride">Apply</button>
                </div>
              </div>
            </div>
          </template>
        </div>

        <footer class="shrink-0 border-t border-brand/10 px-5 py-3 text-center text-[10px] font-medium text-muted/60">
          {{ order?.updated_at ? `Updated ${timeAgo(order.updated_at)} · ` : '' }}Reference {{ order?.reference }}
        </footer>
      </div>
    </div>
  </Teleport>
</template>