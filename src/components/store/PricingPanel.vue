<script setup>
import { ref, computed, onMounted } from 'vue'
import { storeApi } from '../../services/storeApi'
import { currency } from '../../utils/format'
import { toast } from '../../services/toast'

const rows = ref([])
const drafts = ref({})
const loading = ref(true)
const loadError = ref('')

const withBase = computed(() => rows.value.filter((row) => row.base_price_minor !== null))
const unavailable = computed(() =>
  rows.value.filter((row) => row.base_price_minor === null).slice().sort(compareSize),
)

/**
 * Bundle sizes arrive as free text from the provider ("1GB", "1 GB", "500MB"),
 * so they cannot be sorted as strings — "10GB" would land before "2GB". Pull
 * the number and unit out and normalise to megabytes for ordering only.
 */
const sizeInMb = (label) => {
  const match = String(label || '').match(/([\d.]+)\s*(TB|GB|MB|KB)?/i)
  if (!match) return null
  const value = Number(match[1])
  if (!Number.isFinite(value)) return null
  const unit = (match[2] || 'MB').toUpperCase()
  const factor = { KB: 1 / 1024, MB: 1, GB: 1024, TB: 1024 * 1024 }[unit] || 1
  return value * factor
}

const compareSize = (a, b) => {
  const left = sizeInMb(a.size_label)
  const right = sizeInMb(b.size_label)
  if (left !== null && right !== null && left !== right) return left - right
  if (left === null && right !== null) return 1
  if (left !== null && right === null) return -1
  return String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true })
}

// One card per network, each sorted smallest bundle first: owners think in
// networks, not in one long list where MTN, Telecel and Airtel bundles are
// interleaved by sort_order.
const groups = computed(() => {
  const byNetwork = new Map()

  for (const row of withBase.value) {
    const code = row.network || 'Other'
    if (!byNetwork.has(code)) {
      byNetwork.set(code, { code, name: row.network_name || code, rows: [] })
    }
    byNetwork.get(code).rows.push(row)
  }

  return [...byNetwork.values()]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map((group) => ({ ...group, rows: group.rows.slice().sort(compareSize) }))
})

const hydrate = (list) => {
  rows.value = list
  const next = {}
  for (const row of list) {
    next[row.package_id] = {
      price: row.sell_price_minor !== null ? (row.sell_price_minor / 100).toFixed(2) : '',
      active: !!row.is_active,
      sort: row.sort_order || 0,
      saving: false,
    }
  }
  drafts.value = next
}

const load = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const res = await storeApi.packages()
    hydrate(res.data || [])
  } catch (err) {
    loadError.value = err?.message || 'Could not load your prices.'
    toast(loadError.value, 'error')
  } finally {
    loading.value = false
  }
}

const profitFor = (row) => {
  const draft = drafts.value[row.package_id]
  const price = Number(draft?.price)
  if (!Number.isFinite(price) || row.base_price_minor === null) return null
  return Math.round(price * 100) - row.base_price_minor
}

const belowFloor = (row) => {
  const draft = drafts.value[row.package_id]
  if (!draft?.price || row.base_price_minor === null) return false
  const price = Number(draft.price)
  return Number.isFinite(price) && Math.round(price * 100) < row.base_price_minor
}

const save = async (row) => {
  const draft = drafts.value[row.package_id]
  if (!draft || draft.saving) return

  if (belowFloor(row)) {
    toast(`The lowest price for this bundle is ${currency(row.base_price_minor / 100)}.`, 'error')
    return
  }

  draft.saving = true
  try {
    const res = await storeApi.setPackagePrice(row.package_id, {
      sell_price: String(draft.price),
      is_active: draft.active,
      sort_order: Number(draft.sort) || 0,
    })

    const saved = res.data
    const index = rows.value.findIndex((r) => r.package_id === row.package_id)
    if (index !== -1) {
      const fresh = {
        ...rows.value[index],
        sell_price_minor: saved.sell_price_minor,
        is_active: saved.is_active,
        sort_order: saved.sort_order,
      }
      fresh.sellable =
        fresh.is_active &&
        fresh.base_price_minor !== null &&
        fresh.sell_price_minor >= fresh.base_price_minor
      fresh.profit_minor =
        fresh.base_price_minor !== null ? fresh.sell_price_minor - fresh.base_price_minor : null
      rows.value[index] = fresh
    }
    toast('Price saved.', 'success')
  } catch (err) {
    toast(err?.message || 'Could not save that price.', 'error')
  } finally {
    draft.saving = false
  }
}

// Without this the panel renders its own spinner forever: `loading` starts
// true and the only other caller of load() is the Reload button.
onMounted(load)

const setSuggested = (row) => {
  const draft = drafts.value[row.package_id]
  if (!draft || row.base_price_minor === null) return
  // A starting point, not a rule: 20% above the floor, rounded to 0.50.
  const suggested = Math.ceil((row.base_price_minor * 1.2) / 50) / 100
  draft.price = suggested.toFixed(2)
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">My prices</h1>
        <p class="text-xs font-medium text-muted">You keep everything above the shop floor.</p>
      </div>
      <button type="button" class="rounded-xl bg-brand-soft px-3.5 py-2 text-xs font-bold text-brand transition hover:bg-brand/10" @click="load">
        ↻ Reload
      </button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand/15 border-t-brand"></div>
    </div>

    <div v-else-if="loadError" class="clay rounded-3xl bg-surface py-10 text-center">
      <p class="text-sm font-semibold text-red-600">{{ loadError }}</p>
      <button type="button" class="mt-3 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600" @click="load">Retry</button>
    </div>

    <template v-else>
      <div v-if="!withBase.length" class="clay rounded-3xl bg-surface py-14 text-center">
        <p class="font-heading text-base font-bold text-brand-dark/70">No bundles are open to shops yet</p>
        <p class="mt-1 text-sm text-muted">We will show them here as soon as they are available.</p>
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="group in groups"
          :key="group.code"
          class="clay overflow-hidden rounded-3xl bg-surface"
        >
          <div class="flex items-center justify-between gap-2 border-b border-brand/10 bg-bg/60 px-4 py-2.5">
            <div class="flex min-w-0 items-center gap-2">
              <span class="rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-extrabold tracking-widest text-brand uppercase">{{ group.code }}</span>
              <span class="truncate text-xs font-semibold text-muted">{{ group.name }}</span>
            </div>
            <span class="shrink-0 text-[10px] font-bold text-muted/70">{{ group.rows.length }} bundle{{ group.rows.length === 1 ? '' : 's' }}</span>
          </div>

          <div class="hidden grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-3 border-b border-brand/5 px-4 py-2 text-[10px] font-extrabold tracking-widest text-muted uppercase lg:grid">
            <span>Bundle</span>
            <span>Shop floor</span>
            <span>Your price</span>
            <span>You keep</span>
            <span class="text-right">Status</span>
          </div>

          <div v-for="row in group.rows" :key="row.package_id" class="border-b border-brand/5 px-4 py-3 last:border-0">
          <div class="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto] lg:items-center">
            <div class="min-w-0">
              <p class="truncate font-heading text-sm font-bold text-brand-dark">{{ row.name }}</p>
              <p class="mt-0.5 text-xs text-muted">{{ row.size_label || '—' }}</p>
            </div>

            <div class="text-xs font-semibold text-muted">
              <span class="lg:hidden">Floor: </span>{{ currency(row.base_price_minor / 100) }}
            </div>

            <div>
              <label class="flex items-center gap-1.5">
                <span class="text-xs font-bold text-muted">₵</span>
                <input
                  v-model="drafts[row.package_id].price"
                  type="number"
                  min="0"
                  step="0.01"
                  inputmode="decimal"
                  :class="[
                    'clay-well w-full rounded-xl bg-bg px-3 py-2 text-sm font-semibold text-brand-dark outline-none',
                    belowFloor(row) ? 'ring-2 ring-red-300' : '',
                  ]"
                  placeholder="0.00"
                />
              </label>
              <p v-if="belowFloor(row)" class="mt-1 text-[10px] font-semibold text-red-500">
                Minimum {{ currency(row.base_price_minor / 100) }}
              </p>
            </div>

            <div class="text-sm font-bold" :class="(profitFor(row) || 0) > 0 ? 'text-emerald-600' : 'text-muted'">
              {{ profitFor(row) === null ? '—' : currency(profitFor(row) / 100) }}
            </div>

            <div class="flex items-center justify-between gap-2 lg:justify-end">
              <button
                type="button"
                class="rounded-lg px-2 py-1 text-[11px] font-bold transition"
                :class="drafts[row.package_id].active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                @click="drafts[row.package_id].active = !drafts[row.package_id].active"
              >
                {{ drafts[row.package_id].active ? 'On sale' : 'Hidden' }}
              </button>
              <button
                type="button"
                class="rounded-lg bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-brand transition hover:bg-brand/10"
                @click="setSuggested(row)"
              >
                Suggest
              </button>
              <button
                type="button"
                :disabled="drafts[row.package_id].saving"
                class="clay-btn rounded-xl bg-gradient-to-r from-brand to-brand-dark px-3 py-1.5 text-[11px] font-extrabold text-white disabled:opacity-40"
                @click="save(row)"
              >
                {{ drafts[row.package_id].saving ? '…' : 'Save' }}
              </button>
            </div>
          </div>

          <p v-if="row.sell_price_minor !== null && !row.sellable" class="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700">
            This price is below today's floor, so the bundle is not selling. Raise it and save to reopen it.
          </p>

          <details class="mt-2">
            <summary class="cursor-pointer text-[11px] font-semibold text-muted/70 hover:text-brand">Order in shop ({{ drafts[row.package_id].sort }})</summary>
            <label class="mt-1.5 flex items-center gap-2 text-[11px] text-muted">
              Position
              <input v-model.number="drafts[row.package_id].sort" type="number" min="0" class="clay-well w-20 rounded-lg bg-bg px-2 py-1 text-xs" />
              <span class="text-muted/60">lower shows first</span>
            </label>
          </details>
          </div>
        </div>
      </div>

      <div v-if="unavailable.length" class="clay rounded-2xl bg-surface p-4">
        <p class="text-xs font-bold tracking-widest text-muted uppercase">Not open to shops</p>
        <ul class="mt-2 space-y-1.5">
          <li v-for="row in unavailable" :key="row.package_id" class="flex items-center justify-between gap-2 text-xs text-muted">
            <span class="truncate">{{ row.name }}</span>
            <span class="flex shrink-0 items-center gap-1.5">
              <span v-if="row.network" class="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold text-brand">{{ row.network }}</span>
              <span class="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Unavailable</span>
            </span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
