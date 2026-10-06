<script setup>
/**
 * Partner KPIs.
 *
 * Two numbers on this screen are not performance figures and are labelled so an
 * operator cannot misread them:
 *
 *  - Partner GMV is what partners turned over, not our revenue.
 *  - Wallet liabilities is money we hold that is not ours.
 */
import { ref, onMounted } from 'vue'
import { partnerApi } from '../../services/partnerApi'
import { money } from '../../utils/partners'
import { formatDate } from '../../utils/format'
import KpiCard from '../admin/KpiCard.vue'

const from = ref(new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10))
const to = ref(new Date().toISOString().slice(0, 10))

const overview = ref(null)
const revenue = ref([])
const loading = ref(true)
const error = ref('')

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const [o, r] = await Promise.all([
      partnerApi.getOverview({ from: from.value, to: to.value }),
      partnerApi.getRevenue({ from: from.value, to: to.value }),
    ])
    overview.value = o.data
    revenue.value = r.data
  } catch (err) {
    error.value = err?.message || 'Could not load the overview.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <div class="clay flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-surface p-4 sm:p-5">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Partner overview</h1>
        <p class="mt-0.5 text-xs text-muted">
          {{ formatDate(from) }} – {{ formatDate(to) }}
        </p>
      </div>
      <div class="flex items-end gap-2">
        <label class="block">
          <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">From</span>
          <input
            v-model="from"
            type="date"
            class="clay-well rounded-xl bg-bg px-3 py-2 text-xs font-medium text-brand-dark outline-none"
          />
        </label>
        <label class="block">
          <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">To</span>
          <input
            v-model="to"
            type="date"
            class="clay-well rounded-xl bg-bg px-3 py-2 text-xs font-medium text-brand-dark outline-none"
          />
        </label>
        <button
          type="button"
          class="clay-btn rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          :disabled="loading"
          @click="load"
        >
          {{ loading ? 'Loading…' : 'Apply' }}
        </button>
      </div>
    </div>

    <p v-if="error" class="rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{{ error }}</p>

    <template v-if="overview">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Partners" :value="`${overview.tenants.active} active`" :suffix="`/ ${overview.tenants.total}`" />
        <KpiCard label="Partner GMV" :value="money(overview.gmv_minor)" />
        <KpiCard label="Our margin" :value="money(overview.our_margin_minor)" />
        <KpiCard label="Wallet liabilities" :value="money(overview.wallet_liabilities_minor)" />
      </div>

      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Orders" :value="overview.orders.total" :suffix="` · ${overview.orders.success_rate}% delivered`" />
        <KpiCard label="Failed" :value="overview.orders.failed" />
        <KpiCard label="Needs review" :value="overview.orders.supervised" />
        <KpiCard
          label="Settlements queued"
          :value="overview.settlements.pending"
          :suffix="overview.settlements.failed ? ` · ${overview.settlements.failed} failed` : ''"
        />
      </div>

      <!-- The two things an operator should never have to compute themselves. -->
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="clay rounded-2xl bg-surface p-4 sm:p-5">
          <p class="text-[11px] font-bold tracking-widest text-muted uppercase">Owed but not yet paid</p>
          <p class="mt-1 font-heading text-2xl font-black tracking-tight text-amber-600">
            {{ money(overview.settlements.outstanding_minor) }}
          </p>
          <p class="mt-1 text-xs text-muted">
            Partner refunds that have been decided but not yet credited to a wallet. The
            settle cron drains these every five minutes.
          </p>
        </div>
        <div class="clay rounded-2xl bg-surface p-4 sm:p-5">
          <p class="text-[11px] font-bold tracking-widest text-muted uppercase">Topped up this period</p>
          <p class="mt-1 font-heading text-2xl font-black tracking-tight text-brand">
            {{ money(overview.topup_credits_minor) }}
          </p>
          <p class="mt-1 text-xs text-muted">
            Money paid in by partners, against the balance still held above.
          </p>
        </div>
      </div>

      <div class="clay overflow-hidden rounded-2xl bg-surface">
        <div class="border-b border-brand/10 px-4 py-3 sm:px-5">
          <h2 class="font-heading text-sm font-bold tracking-tight text-brand-dark">Revenue by partner</h2>
          <p class="mt-0.5 text-[11px] text-muted">
            Partner GMV is their turnover. Our margin is measured from our own list price,
            not the discount we gave them.
          </p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-brand/10 bg-bg/60 text-[10px] font-extrabold tracking-widest text-muted uppercase">
                <th class="px-4 py-3">Partner</th>
                <th class="px-4 py-3">Tier</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3 text-right">Orders</th>
                <th class="px-4 py-3 text-right">Delivered</th>
                <th class="px-4 py-3 text-right">GMV</th>
                <th class="px-4 py-3 text-right">Our margin</th>
                <th class="px-4 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in revenue" :key="row.tenant_id" class="border-b border-brand/5 last:border-0">
                <td class="px-4 py-3">
                  <p class="font-bold text-brand-dark">{{ row.tenant_name }}</p>
                  <p class="font-mono text-[10px] text-muted">{{ row.tenant_slug }}</p>
                </td>
                <td class="px-4 py-3 text-muted">{{ row.tier_code || '—' }}</td>
                <td class="px-4 py-3">
                  <span class="text-[11px] font-bold" :class="row.tenant_status === 'active' ? 'text-emerald-600' : 'text-amber-600'">
                    {{ row.tenant_status }}
                  </span>
                </td>
                <td class="px-4 py-3 text-right font-semibold">{{ row.orders }}</td>
                <td class="px-4 py-3 text-right font-semibold">{{ row.success_rate }}%</td>
                <td class="px-4 py-3 text-right font-semibold">{{ money(row.partner_gmv_minor) }}</td>
                <td class="px-4 py-3 text-right">
                  <span class="font-bold" :class="row.our_margin_minor < 0 ? 'text-red-600' : 'text-emerald-600'">
                    {{ money(row.our_margin_minor) }}
                  </span>
                  <span v-if="row.margin_pct !== null" class="block text-[10px] text-muted">{{ row.margin_pct }}%</span>
                </td>
                <td class="px-4 py-3 text-right font-semibold">{{ money(row.wallet_balance_minor) }}</td>
              </tr>
              <tr v-if="!revenue.length">
                <td colspan="8" class="px-4 py-8 text-center text-xs text-muted">
                  No partners yet. Create one from the Partners tab to get started.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <div v-else-if="loading" class="py-10 text-center text-xs text-muted">Loading…</div>
  </div>
</template>
