<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api } from '../services/api'
import { openPaystack, paystackKey } from '../services/payment'
import { currency, isActivePayment } from '../utils/format'
import { toast } from '../services/toast'
import StatusPill from '../components/StatusPill.vue'
import Logo from '../components/Logo.vue'

const query = ref('')
const orders = ref([])
const loading = ref(false)
const searched = ref(false)
const error = ref('')
const resuming = ref({})

let pollTimer = null
let lastQuery = ''

const hasActive = computed(() => orders.value.some((o) => isActivePayment(o.status)))

const runLookup = async (q = query.value, noActivePoll = false) => {
  const term = q.trim()
  if (!term) return
  error.value = ''
  loading.value = true
  searched.value = true
  lastQuery = term
  try {
    const res = await api.lookup(term)
    orders.value = res.orders || []
    stopPolling()
    if (hasActive.value && !noActivePoll) {
      pollTimer = setInterval(() => runLookup(term, true), 5000)
    }
  } catch (err) {
    orders.value = []
    error.value = err?.message || 'Could not look up order.'
  } finally {
    loading.value = false
  }
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}
onUnmounted(stopPolling)

const resumePayment = async (order) => {
  resuming.value[order.reference] = true
  try {
    const initReq = await api.initPayment(order.reference, null)
    const payment = initReq.payment || {}
    await openPaystack({
      key: paystackKey(),
      email: `${order.reference.toLowerCase()}@datapadi.gh`,
      amount: payment.amount ?? order.amount,
      reference: payment.reference || order.reference,
    })
    toast('Payment sent — checking your order…', 'info')
    await runLookup(order.reference)
  } catch (err) {
    if (err?.message !== 'Payment cancelled') {
      toast(err?.message || 'Payment failed. Try again.', 'error')
    }
  } finally {
    resuming.value[order.reference] = false
  }
}

onMounted(() => {
  const m = window.location.hash.match(/\?ref=([^&]+)/)
  if (m) {
    query.value = decodeURIComponent(m[1])
    runLookup(query.value)
  }
})
</script>

<template>
  <div class="flex min-h-screen flex-col text-ink">
    <header class="sticky top-0 z-40 border-b border-brand/10 bg-surface/90 backdrop-blur-md">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16">
        <a href="#/" class="flex shrink-0 items-center"><Logo :size="26" :text-class="'text-lg font-heading font-bold tracking-tight'" /></a>
        <nav class="flex items-center gap-3 text-sm font-semibold sm:gap-5">
          <a href="#/" class="text-ink/60 transition-colors hover:text-brand">Home</a>
          <a href="#/track" class="flex items-center gap-1.5 text-brand transition-colors hover:text-accent-dark">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>
            Track order
          </a>
        </nav>
      </div>
    </header>

    <main class="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:py-10">
      <section class="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-brand-dark via-brand to-accent p-5 text-center text-white sm:p-8 md:rounded-[2rem]">
        <div class="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>
        <h1 class="font-heading text-xl font-bold tracking-tight sm:text-2xl">Track your data order</h1>
        <p class="mt-1.5 text-xs text-white/80 sm:text-sm">Enter your order reference or phone number.</p>
        <form class="mx-auto mt-4 flex w-full max-w-sm items-center gap-2 sm:gap-3" @submit.prevent="runLookup()">
          <div class="relative flex-1">
            <svg class="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>
            <input v-model="query" type="search" placeholder="e.g. TB-20260912-BA1ACC or 024…" class="w-full rounded-2xl border border-white/15 bg-black/15 py-3 pr-4 pl-10 text-sm font-medium text-white placeholder:text-white/55 focus:border-white/35 focus:outline-none" />
          </div>
          <button type="submit" class="clay-btn-light shrink-0 rounded-2xl bg-surface px-5 py-3 text-sm font-extrabold text-brand sm:px-6">Track</button>
        </form>
      </section>

      <section v-if="loading && !searched" class="mt-6">
        <div class="flex items-center justify-center py-14">
          <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand/15 border-t-brand"></div>
        </div>
      </section>

      <section v-else-if="searched" class="mt-6">
        <div v-if="loading" class="flex items-center justify-center py-10">
          <div class="h-7 w-7 animate-spin rounded-full border-4 border-brand/15 border-t-brand"></div>
        </div>

        <div v-else-if="error" class="clay flex flex-col items-center justify-center rounded-3xl bg-surface py-10 text-center">
          <p class="font-heading text-base font-bold text-red-600">Look up failed</p>
          <p class="mt-1 text-sm text-muted">{{ error }}</p>
        </div>

        <template v-else>
          <div v-if="hasActive" class="clay-well mb-4 flex items-center gap-2.5 rounded-2xl bg-accent-soft px-4 py-3 text-xs font-semibold text-accent-dark">
            <svg class="h-4 w-4 shrink-0 animate-pulse" viewBox="0 0 24 24" fill="currentColor"><rect x="2.5" y="15" width="3" height="5.5" rx="1"/><rect x="8.5" y="11" width="3" height="9.5" rx="1"/><rect x="14.5" y="7" width="3" height="13.5" rx="1"/></svg>
            One of your orders is still in progress — we're auto-refreshing.
          </div>

          <div v-if="!orders.length" class="clay flex flex-col items-center justify-center rounded-3xl bg-surface py-10 text-center">
            <p class="font-heading text-base font-bold text-brand-dark/70">No orders found</p>
            <p class="mt-1 text-sm text-muted">Double-check the reference or phone number.</p>
          </div>

          <ul class="space-y-3">
            <li v-for="order in orders" :key="order.reference" class="clay overflow-hidden rounded-3xl bg-surface">
              <div class="p-4 sm:p-5">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="font-mono text-[11px] font-bold tracking-wide text-muted">{{ order.reference }}</p>
                    <h3 class="mt-0.5 truncate font-heading text-base font-bold text-brand-dark">{{ order.package }}</h3>
                    <p class="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-muted">
                      <span class="rounded bg-brand-soft px-1.5 py-0.5 font-extrabold text-brand">{{ order.network }}</span>
                      → {{ order.phone }}
                    </p>
                  </div>
                  <StatusPill :status="order.status" small />
                </div>

                <div class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-brand/10 pt-3">
                  <div class="flex items-baseline gap-3">
                    <span class="font-heading text-lg font-black text-brand">{{ currency(order.amount) }}</span>
                    <span class="text-[11px] text-muted">{{ new Date(order.created_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      v-if="order.status === 'PENDING_PAYMENT'"
                      type="button"
                      :disabled="resuming[order.reference]"
                      class="clay-btn-gold rounded-xl bg-gradient-to-r from-accent to-accent-dark px-3.5 py-2 text-xs font-extrabold text-white transition disabled:opacity-40"
                      @click="resumePayment(order)"
                    >
                      {{ resuming[order.reference] ? 'Opening…' : 'Complete payment' }}
                    </button>
                    <button type="button" class="rounded-xl bg-brand-soft px-3 py-2 text-xs font-bold text-brand transition hover:bg-brand/10" @click="runLookup()">Refresh</button>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </template>
      </section>

      <section v-else class="mt-6">
        <div class="clay flex items-start gap-3 rounded-3xl bg-surface p-5 text-sm text-muted">
          <svg class="mt-0.5 h-5 w-5 shrink-0 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          <p>After paying, you'll get an order reference like <b class="text-brand-dark">TB-20260912-BA1ACC</b>. Keep it handy — or look up by your phone number.</p>
        </div>
      </section>
    </main>

    <footer class="mt-6 shrink-0 border-t border-brand/10 bg-surface">
      <div class="mx-auto max-w-6xl px-4 py-5 text-center text-[11px] font-medium text-muted/70">© 2026 DataPadi · Instant data bundles in Ghana</div>
    </footer>
  </div>
</template>