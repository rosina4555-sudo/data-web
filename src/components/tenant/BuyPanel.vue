<script setup>
/**
 * Buy data — the whole point of the dashboard.
 *
 * No API key to paste: this screen signs the purchase with the session, the
 * same credential it used to sign in, and the wallet pays for it. That is the
 * difference between this and the public API — a partner's staff can buy data
 * here without ever seeing a secret, and revoking a key cannot lock them out.
 *
 * The Idempotency-Key is minted when the form opens and reused until a
 * purchase actually lands: a double tap, a retry after a dropped connection
 * and a browser resubmit must all resolve to one order, because each of them
 * would otherwise move real money.
 */
import { ref, onMounted, computed } from 'vue'
import { tenantApi } from '../../services/tenantApi'
import { toast } from '../../services/toast'
import { money, newIdempotencyKey } from '../../utils/partners'
import { currency } from '../../utils/format'
import { isValidGhanaPhone, normalizePhone, networkForPrefix } from '../../utils/phone'
import LoadError from '../LoadError.vue'

const networks = ref([])
const activeNetwork = ref(null)
const packages = ref([])
const meta = ref(null)

const wallet = ref(null)
const selected = ref(null)
const phone = ref('')

const loading = ref(false)
const loadingPackages = ref(false)
const purchasing = ref(false)
const error = ref('')

const idempotencyKey = ref(newIdempotencyKey())
const receipt = ref(null)

const availableMinor = computed(() =>
  wallet.value ? Number(wallet.value.available_minor || 0) : null,
)

const selectedMinor = computed(() => (selected.value ? Number(selected.value.price_minor) : 0))

const shortByMinor = computed(() =>
  availableMinor.value === null ? 0 : Math.max(0, selectedMinor.value - availableMinor.value),
)

const canBuy = computed(
  () =>
    selected.value &&
    isValidGhanaPhone(phone.value.trim()) &&
    !purchasing.value &&
    shortByMinor.value === 0,
)

const loadNetworks = async () => {
  loading.value = true
  error.value = ''
  try {
    const [n, w] = await Promise.all([tenantApi.getNetworks(), tenantApi.getWallet()])
    networks.value = n.data
    wallet.value = w.data
    if (!activeNetwork.value && networks.value.length) {
      await pickNetwork(networks.value[0])
    }
  } catch (err) {
    error.value = err?.message || 'Could not load the catalogue.'
  } finally {
    loading.value = false
  }
}

const pickNetwork = async (network) => {
  activeNetwork.value = network
  selected.value = null
  receipt.value = null
  loadingPackages.value = true
  error.value = ''
  try {
    const res = await tenantApi.getPackages(network.id)
    packages.value = res.data
    meta.value = res.meta
  } catch (err) {
    packages.value = []
    error.value = err?.message || 'Could not load packages.'
  } finally {
    loadingPackages.value = false
  }
}

// Choosing a package clears any receipt still on screen: the confirmation
// describes the order that was placed, not the one being lined up next.
const pick = (pkg) => {
  selected.value = selected.value?.id === pkg.id ? null : pkg
  receipt.value = null
}

const buy = async () => {
  if (!canBuy.value) {
    if (!isValidGhanaPhone(phone.value.trim())) toast('Enter a valid Ghanaian number', 'error')
    else if (shortByMinor.value > 0) toast('Your available balance is short for this package', 'error')
    return
  }

  purchasing.value = true
  try {
    const res = await tenantApi.purchase(
      { package_id: selected.value.id, phone: normalizePhone(phone.value.trim()) },
      idempotencyKey.value,
    )

    // One successful purchase per key: the next submission is a new intent and
    // needs its own key, or it would be treated as a replay of this one.
    idempotencyKey.value = newIdempotencyKey()

    receipt.value = { ...res.data, pricing: res.pricing, wallet: res.wallet }
    toast(`${selected.value.name} sent to ${receipt.value.customer_phone}`, 'success')

    phone.value = ''
    selected.value = null
    wallet.value = (await tenantApi.getWallet()).data
  } catch (err) {
    // 402 (no funds / would breach the reserve) and 409 (package withdrawn
    // under us) both arrive with the reason in `detail`; the key is deliberately
    // NOT rotated here, because this attempt never bought anything.
    error.value = err?.message || 'Purchase failed.'
    toast(error.value, 'error')
  } finally {
    purchasing.value = false
  }
}

onMounted(loadNetworks)
</script>

<template>
  <div class="space-y-5">
    <div class="clay flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-surface p-4 sm:p-5">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Buy data</h1>
        <p class="mt-0.5 text-xs text-muted">
          Paid from your wallet at your tier's price. No API key needed — this session is enough.
        </p>
      </div>
      <div v-if="wallet" class="text-right">
        <p class="text-[10px] font-bold tracking-widest text-muted uppercase">Available to spend</p>
        <p class="font-heading text-xl font-black text-brand">{{ money(wallet.available_minor) }}</p>
        <p v-if="Number(wallet.min_balance_minor)" class="text-[10px] text-muted">
          balance {{ money(wallet.balance_minor) }} · reserve {{ money(wallet.min_balance_minor) }}
        </p>
      </div>
    </div>

    <LoadError :error="error" :busy="loading || loadingPackages" @retry="loadNetworks" />

    <p v-if="loading" class="clay rounded-2xl bg-surface py-10 text-center text-xs text-muted">Loading catalogue…</p>

    <template v-else-if="networks.length">
      <!-- Networks: chips, because there are three of them and a dropdown for
           three choices costs a tap without saving a pixel. -->
      <div class="flex flex-wrap gap-2">
        <button
          v-for="n in networks"
          :key="n.id"
          type="button"
          class="flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition"
          :class="activeNetwork?.id === n.id
            ? 'border-brand bg-brand-soft text-brand shadow-sm'
            : 'border-brand/15 bg-surface text-ink/60 hover:border-brand/30 hover:text-brand'"
          @click="pickNetwork(n)"
        >
          <span class="h-2 w-2 rounded-full" :class="n.code === 'MTN' ? 'bg-amber-400' : n.code === 'TELECEL' ? 'bg-red-500' : 'bg-blue-500'"></span>
          {{ n.name }}
        </button>
      </div>

      <p v-if="loadingPackages" class="clay rounded-2xl bg-surface py-8 text-center text-xs text-muted">Loading packages…</p>

      <template v-else>
        <p v-if="!packages.length" class="clay rounded-2xl bg-surface py-8 text-center text-xs text-muted">
          No packages available on this network right now.
        </p>

        <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            v-for="p in packages"
            :key="p.id"
            type="button"
            class="clay flex items-center justify-between gap-3 rounded-2xl p-4 text-left transition"
            :class="selected?.id === p.id
              ? 'bg-gradient-to-r from-brand to-brand-dark text-white shadow-lg shadow-brand/25'
              : 'bg-surface hover:border-brand/30'"
            @click="pick(p)"
          >
            <span class="min-w-0">
              <span class="block truncate text-sm font-bold">{{ p.size_label || p.name }}</span>
              <span class="block truncate text-[11px] opacity-70">{{ p.name }}</span>
            </span>
            <span class="shrink-0 font-heading text-base font-black">{{ currency(Number(p.price)) }}</span>
          </button>
        </div>

        <div class="clay rounded-2xl bg-surface p-4 sm:p-5">
          <h2 class="font-heading text-sm font-bold tracking-tight text-brand-dark">Send to</h2>

          <div class="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label class="block">
              <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Recipient number</span>
              <input
                v-model="phone"
                inputmode="tel"
                placeholder="024 000 0000"
                class="clay-well w-full rounded-2xl bg-bg px-4 py-3 text-sm font-medium outline-none placeholder:text-muted/40"
              />
              <span class="mt-1 block text-[11px] text-muted">
                <template v-if="phone.trim().length >= 4">
                  <span v-if="isValidGhanaPhone(phone.trim())">
                    {{ networkForPrefix(normalizePhone(phone.trim())) || 'Ghanaian' }} number
                  </span>
                  <span v-else class="text-amber-600">That is not a valid 10-digit Ghanaian number</span>
                </template>
                <template v-else>Local format, e.g. 024 000 0000</template>
              </span>
            </label>

            <button
              type="button"
              :disabled="!canBuy"
              class="rounded-2xl bg-gradient-to-r from-brand to-brand-dark px-6 py-3 text-sm font-bold text-white shadow-md shadow-brand/25 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              @click="buy"
            >
              {{ purchasing ? 'Buying…' : selected ? `Buy ${currency(Number(selected.price))}` : 'Buy' }}
            </button>
          </div>

          <p v-if="selected && shortByMinor > 0" class="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-700">
            Your available balance is {{ money(shortByMinor) }} short. Top up on the Wallet tab and
            this stays here waiting for you.
          </p>
          <p v-else-if="selected" class="mt-3 rounded-xl bg-brand/5 px-3.5 py-2.5 text-xs text-muted">
            Charged on submission, delivered straight away. Your balance after this purchase will be
            about {{ money(Math.max(0, (wallet ? Number(wallet.balance_minor) : 0) - selectedMinor)) }}.
          </p>
        </div>

        <div v-if="receipt" class="clay rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-[10px] font-extrabold tracking-widest text-emerald-700 uppercase">Order placed</p>
              <p class="mt-1 font-mono text-xs text-emerald-800">{{ receipt.reference }}</p>
              <p class="mt-1 text-xs text-emerald-800">
                {{ receipt.status === 'PAID' ? 'Paid from wallet and sending now' : receipt.status }}
                · {{ receipt.customer_phone }}
              </p>
            </div>
            <div class="text-right">
              <p class="font-heading text-xl font-black text-emerald-700">{{ receipt.pricing?.amount }}</p>
              <p class="text-[11px] text-emerald-700">wallet left: {{ receipt.wallet?.balance }}</p>
            </div>
          </div>
        </div>
      </template>
    </template>

    <p v-else class="clay rounded-2xl bg-surface py-10 text-center text-xs text-muted">
      No networks are available to you right now. If that looks wrong, contact support.
    </p>
  </div>
</template>
