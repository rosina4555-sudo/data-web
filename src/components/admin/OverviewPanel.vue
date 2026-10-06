<script setup>
import { ref, computed, onMounted } from 'vue'
import { adminApi } from '../../services/api'
import { currency } from '../../utils/format'
import { toast } from '../../services/toast'
import KpiCard from './KpiCard.vue'
import BarChart from './BarChart.vue'

const loading = ref(true)
const rangeDays = ref(14)
const overview = ref({})
const daily = ref([])
const byNetwork = ref([])
const byProvider = ref([])
const topPackages = ref([])
const balances = ref([])
const walletsLoading = ref(false)
const loadError = ref('')

const rangeParams = () => {
  const to = new Date()
  const from = new Date()
  from.setDate(to.getDate() - (rangeDays.value - 1))
  const fmt = (d) => d.toISOString().slice(0, 10)
  return { from: fmt(from), to: fmt(to) }
}

const loadWallets = async () => {
  walletsLoading.value = true
  try {
    const res = await adminApi.getProviderBalances()
    balances.value = res.data?.balances || res.balances || []
  } catch {
    balances.value = []
  } finally {
    walletsLoading.value = false
  }
}

const load = async () => {
  loading.value = true
  loadError.value = ''
  const p = rangeParams()
  loadWallets()
  try {
    const [ov, dl, net, prov, top] = await Promise.all([
      adminApi.getOverview(p),
      adminApi.getDaily(p),
      adminApi.getByNetwork(p),
      adminApi.getByProvider(p),
      adminApi.getTopPackages({ ...p, limit: 6 }),
    ])
    overview.value = ov.data || ov
    daily.value = dl.data || dl
    byNetwork.value = net.data || net
    byProvider.value = prov.data || prov
    topPackages.value = top.data || top
  } catch (err) {
    loadError.value = err?.message || 'Failed to load analytics.'
    toast(loadError.value, 'error')
  } finally {
    loading.value = false
  }
}

const setRange = (d) => {
  rangeDays.value = d
  load()
}
onMounted(load)

const ordersChart = computed(() =>
  daily.value.map((d) => ({ label: fmtLabel(d.date), value: Number(d.orders) })),
)
const gmvChart = computed(() =>
  daily.value.map((d) => ({ label: fmtLabel(d.date), value: Number(d.gmv) })),
)
const fmtLabel = (iso) => {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const networkTotal = computed(() => byNetwork.value.reduce((s, n) => s + Number(n.gmv || 0), 0))
const networksWithPct = computed(() =>
  byNetwork.value.map((n) => ({
    ...n,
    pct: networkTotal.value ? ((Number(n.gmv) / networkTotal.value) * 100).toFixed(1) : 0,
  })),
)

const topTotal = computed(() => topPackages.value.reduce((s, t) => s + Number(t.gmv || 0), 0))
const topWithPct = computed(() =>
  topPackages.value.map((t) => ({
    ...t,
    pct: topTotal.value ? ((Number(t.gmv) / topTotal.value) * 100).toFixed(1) : 0,
    gmv: Number(t.gmv) || 0,
    orders: Number(t.orders) || 0,
  })),
)

const walletOf = (id) => balances.value.find((b) => b.id === id)
const hasWallet = computed(() => balances.value.length > 0)

const ov = computed(() => overview.value || {})
</script>

<template>
  <div class="space-y-5">
    <!-- Range + title -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Sales overview</h1>
        <p class="text-xs font-medium text-muted">{{ ov.period?.from }} → {{ ov.period?.to }}</p>
      </div>
      <div class="clay-sm flex gap-1 rounded-xl bg-surface p-1">
        <button
          v-for="d in [7, 14, 30]"
          :key="d"
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-bold transition"
          :class="rangeDays === d ? 'bg-gradient-to-r from-brand to-brand-dark text-white shadow-sm' : 'text-muted hover:text-brand'"
          @click="setRange(d)"
        >{{ d }}d</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand/15 border-t-brand"></div>
    </div>

    <div v-else-if="loadError" class="clay flex items-center justify-center gap-3 rounded-3xl bg-surface py-10 text-center">
      <p class="text-sm font-semibold text-red-600">{{ loadError }}</p>
      <button type="button" class="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100" @click="load">Retry</button>
    </div>

    <template v-else>
      <!-- KPIs -->
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard label="Revenue" :value="currency(ov.revenue)" />
        <KpiCard label="GMV (orders)" :value="currency(ov.gmv)" />
        <KpiCard label="Orders" :value="ov.orders || 0" :suffix="' · ' + (ov.success_rate ?? 0) + '% ok'" />
        <KpiCard label="Profit" :value="currency(ov.profit)" />
      </div>

      <div class="grid gap-4 lg:grid-cols-2 lg:gap-5">
        <!-- Orders/day chart -->
        <div class="clay rounded-3xl bg-surface p-4 sm:p-5">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="font-heading text-sm font-bold text-brand-dark">Orders per day</h2>
            <span class="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-extrabold text-brand uppercase">{{ rangeDays }}d</span>
          </div>
          <BarChart :data="ordersChart" :height="'12rem'" bar-color="from-brand to-accent" />
        </div>

        <!-- Revenue/day chart -->
        <div class="clay rounded-3xl bg-surface p-4 sm:p-5">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="font-heading text-sm font-bold text-brand-dark">Revenue per day</h2>
            <span class="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-extrabold text-accent-dark uppercase">₵ GHS</span>
          </div>
          <BarChart :data="gmvChart" :height="'12rem'" bar-color="from-accent to-accent-dark" :money="true" />
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-3 lg:gap-5">
        <!-- By network -->
        <div class="clay rounded-3xl bg-surface p-4 sm:p-5">
          <h2 class="font-heading mb-3 text-sm font-bold text-brand-dark">By network</h2>
          <ul class="space-y-3">
            <li v-for="n in networksWithPct" :key="n.code" class="flex items-center gap-3">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-[10px] font-extrabold text-brand">{{ n.code }}</span>
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline justify-between gap-2">
                  <p class="truncate text-xs font-bold text-brand-dark">{{ n.name }}</p>
                  <p class="text-xs font-black text-brand">{{ currency(n.gmv) }}</p>
                </div>
                <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-brand/10">
                  <div class="h-full rounded-full bg-gradient-to-r from-brand to-accent" :style="{ width: n.pct + '%' }"></div>
                </div>
                <p class="mt-1 text-[10px] font-medium text-muted">{{ n.orders }} orders</p>
              </div>
            </li>
            <li v-if="!byNetwork.length" class="py-6 text-center text-xs text-muted">No paid orders in this window.</li>
          </ul>
        </div>

        <!-- Top packages -->
        <div class="clay rounded-3xl bg-surface p-4 sm:p-5">
          <h2 class="font-heading mb-3 text-sm font-bold text-brand-dark">Top bundles</h2>
          <ul class="space-y-2.5">
            <li v-for="(t, i) in topWithPct" :key="t.package_id" class="flex items-center gap-3">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black" :class="i === 0 ? 'bg-gradient-to-r from-accent to-accent-dark text-white' : 'bg-brand-soft text-brand'">{{ i + 1 }}</span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-bold text-brand-dark">{{ t.name }}</p>
                <p class="text-[10px] font-medium text-muted">{{ t.orders }} orders</p>
              </div>
              <p class="text-xs font-black text-brand">{{ currency(t.gmv) }}</p>
            </li>
            <li v-if="!topPackages.length" class="py-6 text-center text-xs text-muted">No sales yet in this window.</li>
          </ul>
        </div>

        <!-- Providers -->
        <div class="clay rounded-3xl bg-surface p-4 sm:p-5">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="font-heading text-sm font-bold text-brand-dark">Providers</h2>
            <div v-if="hasWallet" class="flex items-center gap-2">
              <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">Wallet</span>
              <button
                type="button"
                class="rounded-lg px-2 py-1 text-[10px] font-bold transition"
                :class="walletsLoading ? 'text-muted' : 'text-brand hover:bg-brand-soft'"
                :disabled="walletsLoading"
                title="Refresh wallet balances"
                @click="loadWallets"
              >{{ walletsLoading ? '…' : '↻' }}</button>
            </div>
          </div>
          <ul class="space-y-3">
            <li v-for="p in byProvider" :key="p.id" class="flex items-center gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline justify-between gap-2">
                  <p class="truncate text-xs font-bold text-brand-dark">{{ p.name }}</p>
                  <p class="text-xs font-black" :class="p.success_rate >= 90 ? 'text-brand' : p.success_rate >= 60 ? 'text-accent-dark' : 'text-red-500'">{{ p.success_rate }}%</p>
                </div>
                <div class="mt-1.5 flex gap-1 text-[10px] font-medium text-muted">
                  <span class="rounded bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700">{{ p.success }} ok</span>
                  <span v-if="p.failed" class="rounded bg-red-50 px-1.5 py-0.5 font-bold text-red-600">{{ p.failed }} fail</span>
                  <span v-if="p.supervised" class="rounded bg-rose-50 px-1.5 py-0.5 font-bold text-rose-600">{{ p.supervised }} review</span>
                  <span class="rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-500">{{ p.pending }} pending</span>
                </div>
                <p v-if="hasWallet" class="mt-1 text-[10px] font-bold" :class="walletOf(p.id)?.error ? 'text-red-500' : 'text-emerald-700'">
                  Wallet {{ walletOf(p.id)?.error ? '— unavailable' : currency(walletOf(p.id).balance) + ' ' + (walletOf(p.id).currency || '') }}
                </p>
              </div>
            </li>
            <li v-if="!byProvider.length" class="py-6 text-center text-xs text-muted">No provider activity yet.</li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</template>