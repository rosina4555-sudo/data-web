<script setup>
/**
 * Payment transactions — the charges themselves, newest first.
 *
 * Deliberately not the ledger on the Wallet tab: entries are movements of the
 * balance, and a payment that has not credited has moved nothing, so it can
 * only be seen here. That is the whole reason this list exists — the partner
 * whose top-up has not landed needs the charge, its reference and its status,
 * and needs to be able to do something about it without opening a ticket.
 *
 * Verification asks Paystack about one transaction and settles it from the
 * answer, under the same rules the webhook runs under, so pressing the button
 * twice can show a credit twice but can never make one. A 502 from it means
 * the gateway was unreachable — not that the payment did not happen.
 */
import { ref, onMounted, watch } from 'vue'
import { tenantApi } from '../../services/tenantApi'
import { toast } from '../../services/toast'
import { money, topupStatusMeta } from '../../utils/partners'
import { formatDateTime } from '../../utils/format'
import LoadError from '../LoadError.vue'
import Pagination from '../admin/Pagination.vue'

const rows = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const page = ref(1)
const loading = ref(false)
const error = ref('')
const verifying = ref(null)

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await tenantApi.getTopups({ page: page.value, per_page: 15 })
    rows.value = res.data
    meta.value = res.meta
  } catch (err) {
    rows.value = []
    error.value = err?.message || 'Could not load your transactions.'
  } finally {
    loading.value = false
  }
}

const verify = async (row) => {
  if (verifying.value) return
  verifying.value = row.reference

  try {
    const topup = (await tenantApi.verifyTopup(row.reference)).data
    const i = rows.value.findIndex((t) => t.reference === topup.reference)
    if (i !== -1) rows.value[i] = { ...rows.value[i], ...topup }

    if (topup.status === 'success') {
      toast(
        topup.settled
          ? 'Confirmed — your wallet has been credited.'
          : 'Already credited — the wallet was not charged twice.',
        'success',
      )
    } else if (topup.status === 'failed') {
      toast(topup.error_message || 'Paystack reports this payment as failed — nothing was credited.', 'error')
    } else if (topup.gateway_status) {
      toast(`Paystack says ${topup.gateway_status}: ${topup.gateway_message}`, 'info')
    } else {
      toast(topup.gateway_message || 'Paystack has not confirmed this payment yet — try again shortly.', 'info')
    }
  } catch (err) {
    // 502 from the gateway: the row is unchanged and still worth checking.
    toast(err?.message || 'Could not reach Paystack — try again shortly.', 'error')
  } finally {
    verifying.value = null
  }
}

// Paging re-reads this list only.
watch(page, load)

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <div class="clay flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-surface p-4 sm:p-5">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Transactions</h1>
        <p class="mt-0.5 text-xs text-muted">
          Every top-up, what Paystack did with it, and a button to ask them again.
        </p>
      </div>
      <p class="text-[11px] text-muted">newest first</p>
    </div>

    <LoadError :error="error" :busy="loading" @retry="load" />

    <p v-if="loading" class="clay rounded-2xl bg-surface py-10 text-center text-xs text-muted">
      Loading transactions…
    </p>

    <p v-else-if="!rows.length" class="clay rounded-2xl bg-surface py-10 text-center text-xs text-muted">
      No top-ups yet — the Wallet tab starts one.
    </p>

    <template v-else>
      <!-- Desktop table -->
      <div class="clay hidden overflow-hidden rounded-2xl bg-surface lg:block">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-brand/10 bg-bg/60 text-[10px] font-extrabold tracking-widest text-muted uppercase">
                <th class="px-4 py-3">Reference</th>
                <th class="px-4 py-3 text-right">Amount</th>
                <th class="px-4 py-3">Channel</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3">Started</th>
                <th class="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="t in rows"
                :key="t.id"
                class="border-b border-brand/5 transition last:border-0 hover:bg-brand/[0.03]"
              >
                <td class="px-4 py-3 font-mono text-[11px] font-semibold text-brand-dark">{{ t.reference }}</td>
                <td class="px-4 py-3 text-right font-bold text-brand-dark">
                  {{ money(t.amount_minor) }} <span class="text-[10px] font-semibold text-muted">{{ t.currency }}</span>
                </td>
                <td class="px-4 py-3 text-ink/70">{{ t.channel || '—' }}</td>
                <td class="px-4 py-3">
                  <span
                    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold"
                    :class="topupStatusMeta(t.status).cls"
                  >
                    <span class="h-1.5 w-1.5 rounded-full bg-current opacity-70"></span>
                    {{ topupStatusMeta(t.status).label }}
                  </span>
                </td>
                <td class="px-4 py-3 text-[11px] text-muted">
                  {{ formatDateTime(t.paid_at || t.created_at) }}
                </td>
                <td class="px-4 py-3 text-right">
                  <button
                    v-if="t.status === 'pending'"
                    type="button"
                    :disabled="verifying"
                    class="rounded-lg border border-brand/20 px-2.5 py-1.5 text-[11px] font-bold text-brand transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
                    @click="verify(t)"
                  >
                    {{ verifying === t.reference ? 'Asking Paystack…' : 'Check with Paystack' }}
                  </button>
                  <span v-else-if="t.error_message" class="text-[11px] text-muted" :title="t.error_message">
                    {{ t.error_message }}
                  </span>
                  <span v-else class="text-[11px] text-muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mobile cards -->
      <ul class="space-y-3 lg:hidden">
        <li v-for="t in rows" :key="t.id" class="clay rounded-2xl bg-surface p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate font-mono text-[11px] font-semibold text-brand-dark">{{ t.reference }}</p>
              <p class="mt-0.5 truncate text-xs text-muted">
                {{ t.channel || 'card' }} · {{ formatDateTime(t.paid_at || t.created_at) }}
              </p>
            </div>
            <div class="shrink-0 text-right">
              <p class="font-heading text-sm font-black text-brand-dark">{{ money(t.amount_minor) }}</p>
              <span
                class="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                :class="topupStatusMeta(t.status).cls"
              >{{ topupStatusMeta(t.status).label }}</span>
            </div>
          </div>

          <p v-if="t.status === 'pending' && t.error_message" class="mt-2 text-[11px] text-muted">
            {{ t.error_message }}
          </p>

          <button
            v-if="t.status === 'pending'"
            type="button"
            :disabled="verifying"
            class="mt-3 w-full rounded-xl border border-brand/20 px-4 py-2.5 text-xs font-bold text-brand transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
            @click="verify(t)"
          >
            {{ verifying === t.reference ? 'Asking Paystack…' : 'Check with Paystack' }}
          </button>
        </li>
      </ul>

      <Pagination v-model:page="page" :total-pages="meta.last_page" :total="meta.total" />
    </template>
  </div>
</template>
