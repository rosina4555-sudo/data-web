<script setup>
/**
 * Overview — how this account is doing, over a window the partner chooses.
 *
 * Money comes from the wallet ledger on the server side, so what is on this
 * screen reconciles against the Wallet tab: two different questions (what
 * happened vs. what is in the account) answered from one source.
 *
 * The chart plots a full series including empty days, and the metric toggle
 * exists because "we spent less" and "we sent fewer orders" are different
 * stories — a price change moves one and not the other.
 */
import { ref, onMounted, computed } from 'vue'
import { tenantApi } from '../../services/tenantApi'
import { money } from '../../utils/partners'
import { currency } from '../../utils/format'
import KpiCard from '../admin/KpiCard.vue'
import BarChart from '../admin/BarChart.vue'
import LoadError from '../LoadError.vue'

const dayInput = (date) => date.toISOString().slice(0, 10)

const preset = ref(30)
const from = ref(dayInput(new Date(Date.now() - 29 * 864e5)))
const to = ref(dayInput(new Date()))

const data = ref(null)
const loading = ref(false)
const error = ref('')

const metric = ref('spend')

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    data.value = (await tenantApi.getAnalytics({ from: from.value, to: to.value })).data
  } catch (err) {
    data.value = null
    error.value = err?.message || 'Could not load your numbers.'
  } finally {
    loading.value = false
  }
}

const applyPreset = (days) => {
  preset.value = days
  from.value = dayInput(new Date(Date.now() - (days - 1) * 864e5))
  to.value = dayInput(new Date())
  load()
}

// A hand-typed range is neither of the presets, so neither stays highlighted —
// leaving one lit would claim a window the inputs are no longer showing.
const applyCustom = () => {
  preset.value = 0
  load()
}

const chart = computed(() => {
  const series = data.value?.by_day || []
  return series.map((d) => ({
    // Short enough that 90 bars still label every other one legibly.
    label: d.day.slice(5),
    value: metric.value === 'spend' ? (d.spend_minor || 0) / 100 : d.orders || 0,
  }))
})

const stats = computed(() => {
  const a = data.value
  if (!a) return null
  return {
    spend: money(a.spend_minor),
    orders: a.orders.total,
    rate: `${a.orders.success_rate}%`,
    wallet: a.wallet ? money(a.wallet.balance_minor) : '—',
  }
})

const rateTone = computed(() => {
  const rate = data.value?.orders.success_rate ?? 0
  if (!data.value?.orders.total) return 'text-muted'
  return rate >= 95 ? 'text-emerald-600' : rate >= 80 ? 'text-amber-600' : 'text-red-500'
})

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <div class="clay flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-surface p-4 sm:p-5">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Overview</h1>
        <p class="mt-0.5 text-xs text-muted">
          Your orders and your wallet's movement — nothing from anyone else's account.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="flex rounded-xl bg-bg p-1">
          <button
            v-for="d in [7, 30, 90]"
            :key="d"
            type="button"
            class="rounded-lg px-2.5 py-1 text-[11px] font-bold transition"
            :class="preset === d ? 'bg-surface text-brand shadow-sm' : 'text-muted hover:text-brand'"
            @click="applyPreset(d)"
          >{{ d }}d</button>
        </div>
        <div class="flex items-center gap-1.5">
          <input v-model="from" type="date" class="clay-well rounded-xl bg-bg px-2.5 py-1.5 text-[11px] outline-none" @change="applyCustom" />
          <span class="text-[11px] text-muted">to</span>
          <input v-model="to" type="date" class="clay-well rounded-xl bg-bg px-2.5 py-1.5 text-[11px] outline-none" @change="applyCustom" />
        </div>
      </div>
    </div>

    <LoadError :error="error" :busy="loading" @retry="load" />

    <template v-if="data">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Wallet balance" :value="stats.wallet" />
        <KpiCard label="Spend in period" :value="stats.spend" />
        <KpiCard label="Orders" :value="stats.orders" />
        <div class="clay flex flex-col gap-1 rounded-2xl bg-surface p-4 sm:p-5">
          <p class="text-[11px] font-bold tracking-widest text-muted uppercase">Delivered</p>
          <p class="font-heading text-2xl font-black tracking-tight sm:text-3xl" :class="rateTone">
            {{ data.orders.total ? data.orders.success : 0 }}
          </p>
          <p class="text-[11px] text-muted">
            {{ data.orders.success_rate }}% success
            <span v-if="data.orders.in_progress"> · {{ data.orders.in_progress }} in flight</span>
          </p>
        </div>
      </div>

      <div class="clay rounded-2xl bg-surface p-4 sm:p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="font-heading text-sm font-bold tracking-tight text-brand-dark">
              {{ metric === 'spend' ? 'Wallet spend' : 'Orders placed' }}
            </h2>
            <p class="mt-0.5 text-[11px] text-muted">
              {{ data.period.from }} → {{ data.period.to }}
              <span v-if="data.refunded_minor"> · {{ money(data.refunded_minor) }} refunded</span>
              <span v-if="data.topups_minor"> · {{ money(data.topups_minor) }} topped up</span>
            </p>
          </div>
          <div class="flex rounded-xl bg-bg p-1">
            <button
              v-for="m in ['spend', 'orders']"
              :key="m"
              type="button"
              class="rounded-lg px-2.5 py-1 text-[11px] font-bold capitalize transition"
              :class="metric === m ? 'bg-surface text-brand shadow-sm' : 'text-muted hover:text-brand'"
              @click="metric = m"
            >{{ m }}</button>
          </div>
        </div>

        <div class="mt-4">
          <BarChart
            v-if="chart.length"
            :data="chart"
            :money="metric === 'spend'"
            bar-color="from-brand to-accent"
            height="11rem"
          />
          <p v-else class="py-8 text-center text-xs text-muted">No days in that range.</p>
        </div>
      </div>

      <div class="grid gap-5 lg:grid-cols-2">
        <div class="clay rounded-2xl bg-surface p-4 sm:p-5">
          <h2 class="font-heading text-sm font-bold tracking-tight text-brand-dark">By network</h2>
          <p v-if="!data.by_network.length" class="py-6 text-center text-xs text-muted">
            No orders in this period yet.
          </p>
          <template v-else>
            <div class="mt-3 hidden overflow-hidden rounded-xl sm:block">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="border-b border-brand/10 bg-bg/60 text-[10px] font-extrabold tracking-widest text-muted uppercase">
                    <th class="px-3 py-2">Network</th>
                    <th class="px-3 py-2 text-right">Orders</th>
                    <th class="px-3 py-2 text-right">Delivered</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="n in data.by_network" :key="n.code" class="border-b border-brand/5 last:border-0">
                    <td class="px-3 py-2 font-bold text-brand-dark">{{ n.name }}</td>
                    <td class="px-3 py-2 text-right text-ink/70">{{ n.orders }}</td>
                    <td class="px-3 py-2 text-right text-emerald-600">{{ n.success }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ul class="mt-3 space-y-2 sm:hidden">
              <li v-for="n in data.by_network" :key="n.code" class="flex items-center justify-between rounded-xl bg-bg px-3 py-2.5">
                <span class="text-xs font-bold text-brand-dark">{{ n.name }}</span>
                <span class="text-[11px] text-muted">{{ n.success }}/{{ n.orders }} delivered</span>
              </li>
            </ul>
          </template>
        </div>

        <div class="clay rounded-2xl bg-surface p-4 sm:p-5">
          <h2 class="font-heading text-sm font-bold tracking-tight text-brand-dark">Account</h2>
          <dl class="mt-3 space-y-2 text-xs">
            <div class="flex items-center justify-between gap-3">
              <dt class="text-muted">Tier</dt>
              <dd class="font-bold text-brand-dark">{{ data.account_type?.name || 'Retail pricing' }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-muted">Average order value</dt>
              <dd class="font-bold text-brand-dark">{{ currency((data.orders.avg_value_minor || 0) / 100) }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-muted">Top-ups in period</dt>
              <dd class="font-bold text-brand-dark">{{ money(data.topups_minor) }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-muted">Failed / refunded</dt>
              <dd class="font-bold text-brand-dark">{{ data.orders.failed }} / {{ data.orders.refunded }}</dd>
            </div>
          </dl>
          <p class="mt-3 border-t border-brand/5 pt-3 text-[10px] text-muted">
            Money here is what moved through your wallet, so it matches the Wallet tab to the pesewa.
          </p>
        </div>
      </div>
    </template>

    <p v-else-if="!loading && !error" class="clay rounded-2xl bg-surface py-10 text-center text-xs text-muted">
      Loading your numbers…
    </p>
  </div>
</template>
