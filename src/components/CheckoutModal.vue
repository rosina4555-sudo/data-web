<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api } from '../services/api'
import { openPaystack } from '../services/payment'
import { currency } from '../utils/format'
import { isValidGhanaPhone, networkForPrefix, normalizePhone, phoneHint } from '../utils/phone'
import { toast } from '../services/toast'
import StatusPill from './StatusPill.vue'
import Logo from './Logo.vue'

const props = defineProps({
  network: { type: Object, required: true },
  pkg: { type: Object, required: true },
})
const emit = defineEmits(['close', 'track'])

const phone = ref('')
const email = ref('')
const step = ref('form') // form | paying | awaiting | done | error
const order = ref(null)
const error = ref('')
const verifying = ref(false) // popup finished, polling order status

const amount = computed(() => Number(props.pkg.sell_price || 0))
const networkGood = computed(() => {
  const net = networkForPrefix(phoneHint(phone.value))
  if (!net) return null
  return net
})

const phoneValid = computed(() => isValidGhanaPhone(normalizePhone(phone.value)))
const canBuy = computed(() => phoneValid.value && ['form'].includes(step.value))
const networkMatchHint = computed(() => {
  if (!phoneHint(phone.value) || !networkForPrefix(phoneHint(phone.value))) return null
  const net = networkForPrefix(phoneHint(phone.value))
  if (net !== props.network.code) {
    return `This number looks like ${net}. You picked ${props.network.code}.`
  }
  return `This number matches ${props.network.code}.`
})

let pollTimer = null
let closed = false

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onUnmounted(stopPolling)

const close = () => {
  closed = true
  stopPolling()
  emit('close')
}

const idempotencyKey = () =>
  crypto.randomUUID().replace(/[^A-Za-z0-9_-]/g, '')

const pollUntilSettled = async () => {
  const ref = order.value.reference
  const deadline = Date.now() + 2.5 * 60 * 1000
  const tick = async () => {
    if (closed) return
    try {
      const res = await api.getOrder(ref)
      const o = res.order || res
      order.value = o
      if (o.status !== 'PENDING_PAYMENT') {
        stopPolling()
        if (o.status === 'PAID' || o.status === 'SUBMITTED' || o.status === 'SUCCESS') {
          step.value = 'done'
          toast('Payment received! We are delivering your data.', 'success')
        } else {
          step.value = 'error'
          error.value = `Order is ${o.status}. Please track it for updates.`
        }
        return
      }
    } catch {
      /* keep polling */
    }
    if (Date.now() >= deadline) {
      stopPolling()
      verifying.value = false
      step.value = 'awaiting'
      toast('We received your payment but the confirmation is taking long. Track your order for the latest status.', 'info')
    }
  }
  await tick()
  if (!pollTimer && !closed) {
    pollTimer = setInterval(tick, 2500)
  }
}

const buy = async () => {
  if (!canBuy.value) return
  error.value = ''
  const key = idempotencyKey()

  try {
    step.value = 'paying'
    const created = await api.createOrder(props.pkg.id, normalizePhone(phone.value), key)
    order.value = created.order || created
    const ref = order.value.reference

    const initReq = await api.initPayment(ref, email.value || null)
    const payment = initReq.payment || {}

    step.value = 'awaiting'

    try {
      await openPaystack({
        accessCode: payment.access_code,
        onClose: () => {
          toast('Payment window closed. Your order is still open.', 'info')
          step.value = 'form'
        },
      })
      verifying.value = true
    } catch (payErr) {
      if (payErr?.message === 'Payment cancelled') {
        toast('Payment cancelled. Your order is still open.', 'info')
        step.value = 'form'
        return
      }
      throw payErr
    }
    await pollUntilSettled()
  } catch (err) {
    step.value = 'error'
    error.value = err?.message || 'Something went wrong. Please try again.'
    toast(error.value, 'error')
  }
}

const retryAfterError = () => {
  step.value = 'form'
  error.value = ''
}

onMounted(() => {
  // focus phone input on mobile to speed up entry
  setTimeout(() => {
    const el = document.getElementById('buy-phone')
    if (el && window.innerWidth < 640) el.focus({ preventScroll: true })
  }, 350)
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-end justify-center bg-brand-dark/45 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" @click.self="close">
      <div class="clay flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface sm:max-w-md sm:rounded-3xl">
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-brand/10 px-5 py-4">
          <div class="flex items-center gap-2.5">
            <span class="rounded-full bg-gradient-to-r from-brand to-accent px-2.5 py-1 text-[10px] font-extrabold tracking-widest text-white uppercase">
              {{ network.code }}
            </span>
            <h2 class="font-heading text-base font-bold tracking-tight text-brand-dark">{{ pkg.name }}</h2>
          </div>
          <button type="button" aria-label="Close" class="flex h-8 w-8 items-center justify-center rounded-xl text-muted transition hover:bg-brand/5 hover:text-brand" @click="close">✕</button>
        </div>

        <!-- Body -->
        <div class="hide-scrollbar flex-1 overflow-y-auto px-5 py-4">
          <!-- STEP: form -->
          <div v-if="step === 'form'" class="space-y-4">
            <div class="clay-well flex items-center justify-between rounded-2xl bg-brand-soft px-4 py-3">
              <div>
                <p class="text-[10px] font-bold tracking-widest text-muted uppercase">To pay</p>
                <p class="font-heading text-2xl font-black text-brand">{{ currency(amount) }}</p>
              </div>
              <svg class="h-8 w-8 text-brand/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor" stroke="none"/></svg>
            </div>

            <label class="block">
              <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Phone number to receive data</span>
              <input
                id="buy-phone"
                v-model="phone"
                type="tel"
                inputmode="numeric"
                maxlength="13"
                placeholder="024 000 0000"
                class="w-full rounded-2xl border border-brand/15 bg-bg px-4 py-3 text-base font-semibold text-brand-dark outline-none transition placeholder:text-muted/40 focus:border-brand/40 focus:bg-surface"
                @input="phone = phoneHint(phone)"
              />
              <span
                v-if="phoneHint(phone)"
                class="mt-1.5 block text-[11px] font-semibold"
                :class="networkGood === network.code ? 'text-brand' : phoneValid ? 'text-red-500' : 'text-muted'"
              >
                {{ networkMatchHint }}
              </span>
              <span v-else class="mt-1.5 block text-[11px] text-muted/70">We'll top up this number automatically.</span>
            </label>

            <label class="block">
              <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Email <span class="font-medium text-muted/70">(optional — for your receipt)</span></span>
              <input
                v-model="email"
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
                class="w-full rounded-2xl border border-brand/15 bg-bg px-4 py-3 text-sm font-medium text-brand-dark outline-none transition placeholder:text-muted/40 focus:border-brand/40 focus:bg-surface"
              />
            </label>

            <button
              type="button"
              :disabled="!canBuy"
              class="clay-btn-gold w-full rounded-2xl bg-gradient-to-r from-accent to-accent-dark py-3.5 text-sm font-extrabold tracking-wide text-white transition focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              @click="buy"
            >
              Pay {{ currency(amount) }} securely →
            </button>
            <p class="text-center text-[11px] font-medium text-muted/70">
              Payments handled by <span class="font-bold text-brand">Paystack</span> · Mobile Money & cards accepted
            </p>
          </div>

          <!-- STEP: paying -->
          <div v-else-if="step === 'paying'" class="flex flex-col items-center justify-center gap-3 py-10">
            <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand/15 border-t-brand"></div>
            <p class="text-sm font-semibold text-brand-dark">Preparing your order…</p>
          </div>

          <!-- STEP: awaiting (popup hint / verifying) -->
          <div v-else-if="step === 'awaiting'" class="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div v-if="verifying" class="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft">
              <div class="h-7 w-7 animate-spin rounded-full border-4 border-brand/15 border-t-brand"></div>
            </div>
            <div v-else class="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft">
              <svg class="h-7 w-7 animate-pulse text-accent-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <p v-if="verifying" class="font-heading text-base font-bold text-brand-dark">Verifying your payment…</p>
            <p v-else class="font-heading text-base font-bold text-brand-dark">Complete payment to confirm your order</p>
            <p v-if="verifying" class="max-w-[16rem] text-xs leading-relaxed text-muted">
              Confirming your transaction with Paystack. This usually takes a few seconds — we'll show your receipt when it's done.
            </p>
            <p v-else class="max-w-[16rem] text-xs leading-relaxed text-muted">
              If the payment window closed, your order stays open — use <b>Track order</b> to pay again.
            </p>
          </div>

          <!-- STEP: done -->
          <div v-else-if="step === 'done'" class="flex flex-col items-center gap-4 py-8 text-center">
            <div class="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </div>
            <div>
              <p class="font-heading text-lg font-black text-brand-dark">Payment received!</p>
              <p class="mt-1 text-sm text-muted">We're topping up <b class="text-brand-dark">{{ order?.phone }}</b>. Your data is on its way.</p>
            </div>
            <div class="w-full space-y-2 rounded-2xl bg-bg p-4 text-left">
              <div class="flex items-center justify-between text-xs font-semibold">
                <span class="text-muted">Reference</span>
                <span class="font-mono text-brand-dark">{{ order?.reference }}</span>
              </div>
              <div class="flex items-center justify-between text-xs font-semibold">
                <span class="text-muted">Amount</span>
                <span class="text-brand-dark">{{ currency(order?.amount ?? amount) }}</span>
              </div>
              <div class="flex items-center justify-between text-xs font-semibold">
                <span class="text-muted">Status</span>
                <StatusPill small :status="order?.status" />
              </div>
            </div>
            <div class="flex w-full gap-2">
              <button
                type="button"
                class="clay-btn-light flex-1 rounded-2xl bg-surface py-3 text-sm font-extrabold text-brand"
                @click="emit('track', order?.reference)"
              >
                Track delivery
              </button>
              <button
                type="button"
                class="clay-btn flex-1 rounded-2xl bg-gradient-to-r from-brand to-brand-dark py-3 text-sm font-extrabold text-white"
                @click="close"
              >
                Done
              </button>
            </div>
          </div>

          <!-- STEP: error -->
          <div v-else class="flex flex-col items-center gap-3 py-8 text-center">
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
              <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </div>
            <div>
              <p class="font-heading text-base font-black text-brand-dark">Something went wrong</p>
              <p class="mt-1 max-w-[18rem] text-xs leading-relaxed text-muted">{{ error }}</p>
            </div>
            <div class="flex w-full gap-2">
              <button type="button" class="clay-btn-light flex-1 rounded-2xl bg-surface py-3 text-sm font-extrabold text-brand" @click="retryAfterError">Try again</button>
              <button type="button" class="clay-btn flex-1 rounded-2xl bg-gradient-to-r from-brand to-brand-dark py-3 text-sm font-extrabold text-white" @click="emit('track', order?.reference)">Track order</button>
            </div>
          </div>
        </div>

        <footer class="shrink-0 border-t border-brand/10 px-5 py-3">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold tracking-widest text-muted/60 uppercase">Powered by</span>
            <Logo :size="18" :text-class="'text-sm font-heading font-bold tracking-tight'" />
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>