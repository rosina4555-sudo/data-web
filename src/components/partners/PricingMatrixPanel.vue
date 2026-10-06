<script setup>
/**
 * The pricing matrix: every tier against every package.
 *
 * Read it for coverage, write it one tier at a time. Editing a 6×40 grid in a
 * single form is how a partner ends up accidentally repriced across every
 * package, so the matrix is a report and the tier editor is the only place a
 * price can change.
 *
 * Prices are sent as major-unit strings ("3.50") because that is what the API
 * accepts; blanking a price deactivates the override and lets the tier's
 * fallback rule apply again, which is not the same as setting it to zero.
 */
import { ref, computed, onMounted } from 'vue'
import { partnerApi } from '../../services/partnerApi'
import { toast } from '../../services/toast'
import { money, percent } from '../../utils/partners'

const tiers = ref([])
const packages = ref([])
const loading = ref(true)
const error = ref('')
const q = ref('')

const editingTier = ref(null)
const draft = ref({})
const saving = ref(false)

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await partnerApi.getPricingMatrix({ q: q.value || undefined })
    tiers.value = res.data.tiers
    packages.value = res.data.packages
  } catch (err) {
    error.value = err?.message || 'Could not load the pricing matrix.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

/** Cells that would lose money or cannot be sold at all, surfaced first. */
const problems = computed(() => {
  const out = []
  for (const tier of tiers.value) {
    tier.cells.forEach((cell, i) => {
      const pkg = packages.value[i]
      if (cell.below_cost) out.push({ tier, pkg, cell, kind: 'below_cost' })
      else if (!cell.sellable) out.push({ tier, pkg, cell, kind: 'unsellable' })
    })
  }
  return out
})

const openTier = (tier) => {
  editingTier.value = tier
  draft.value = {}
  tier.cells.forEach((cell, i) => {
    const pkg = packages.value[i]
    // Pre-fill with the override if one exists, otherwise the effective price so
    // the operator edits what is actually being charged, not a blank.
    const current = cell.custom_price_minor ?? cell.price_minor
    draft.value[pkg.package_id] = current === null ? '' : (current / 100).toFixed(2)
  })
}

const isDirty = computed(() => {
  if (!editingTier.value) return false
  return editingTier.value.cells.some((cell, i) => {
    const pkg = packages.value[i]
    const current = cell.custom_price_minor ?? cell.price_minor
    const before = current === null ? '' : (current / 100).toFixed(2)
    return (draft.value[pkg.package_id] ?? '') !== before
  })
})

const clearOverride = (packageId) => {
  draft.value[packageId] = ''
  draft.value[`__clear_${packageId}`] = true
}

const save = async () => {
  if (!editingTier.value || saving.value) return
  saving.value = true

  const prices = []
  for (const [packageId, raw] of Object.entries(draft.value)) {
    if (packageId.startsWith('__clear_')) continue
    const value = String(raw ?? '').trim()
    prices.push(
      value === ''
        ? { package_id: Number(packageId), null_price: true }
        : { package_id: Number(packageId), price: value },
    )
  }

  try {
    await partnerApi.saveTierPrices(editingTier.value.account_type.id, prices)
    toast(`${editingTier.value.account_type.name} prices saved`, 'success')
    editingTier.value = null
    load()
  } catch (err) {
    toast(err?.message || 'Could not save prices. Nothing was changed.', 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="clay flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-surface p-4 sm:p-5">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Pricing matrix</h1>
        <p class="mt-0.5 text-xs text-muted">
          What each tier pays for each package, and what we keep. Click a tier to edit it.
        </p>
      </div>
      <label class="block">
        <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Find package</span>
        <input
          v-model="q"
          type="search"
          placeholder="1GB, Daily, MTN…"
          class="clay-well w-full rounded-xl bg-bg px-3 py-2 text-xs font-medium text-brand-dark outline-none sm:w-56"
          @keyup.enter="load"
        />
      </label>
    </div>

    <p v-if="error" class="rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{{ error }}</p>

    <!-- Loudest first. A margin problem here is money being given away silently. -->
    <div v-if="problems.length" class="rounded-2xl border border-red-200 bg-red-50 p-4">
      <p class="font-heading text-xs font-bold text-red-800">
        {{ problems.length }} {{ problems.length === 1 ? 'cell needs' : 'cells need' }} attention
      </p>
      <ul class="mt-1.5 space-y-0.5">
        <li v-for="p in problems.slice(0, 6)" :key="`${p.tier.account_type.id}-${p.pkg.package_id}`" class="text-[11px] text-red-700">
          <span class="font-bold">{{ p.tier.account_type.name }}</span> · {{ p.pkg.package }}
          <span v-if="p.pkg.network"> ({{ p.pkg.network }})</span>
          —
          <span v-if="p.kind === 'below_cost'">
            priced {{ money(p.cell.price_minor) }} against a provider cost of
            {{ money(p.pkg.provider_cost_minor) }}
          </span>
          <span v-else-if="p.pkg.provider_cost_minor === null">no provider cost set, so it cannot be sold</span>
          <span v-else>not sellable</span>
        </li>
      </ul>
      <p v-if="problems.length > 6" class="mt-1.5 text-[11px] text-red-700">
        and {{ problems.length - 6 }} more.
      </p>
    </div>

    <div v-if="loading" class="py-10 text-center text-xs text-muted">Loading…</div>

    <div v-else class="clay overflow-hidden rounded-2xl bg-surface">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-brand/10 bg-bg/60 text-[10px] font-extrabold tracking-widest text-muted uppercase">
              <th class="sticky left-0 z-10 bg-bg/95 px-4 py-3">Tier</th>
              <th v-for="pkg in packages" :key="pkg.package_id" class="px-3 py-3 whitespace-nowrap">
                <p class="text-brand-dark">{{ pkg.package }}</p>
                <p class="text-[9px] font-semibold tracking-normal text-muted uppercase">
                  {{ pkg.network }} · list {{ money(pkg.list_price_minor) }}
                </p>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="tier in tiers"
              :key="tier.account_type.id"
              class="group cursor-pointer border-b border-brand/5 last:border-0 hover:bg-brand/[0.03]"
              @click="openTier(tier)"
            >
              <td class="sticky left-0 z-10 bg-surface px-4 py-3 group-hover:bg-[#f6f8f5]">
                <p class="font-bold text-brand-dark">{{ tier.account_type.name }}</p>
                <p class="font-mono text-[10px] text-muted">{{ tier.account_type.code }}</p>
                <p class="mt-1 text-[10px] font-semibold" :class="tier.account_type.is_active ? 'text-emerald-600' : 'text-slate-400'">
                  {{ tier.custom_overrides }} custom
                  <span v-if="tier.below_cost_cells" class="ml-1 text-red-600">· {{ tier.below_cost_cells }} below cost</span>
                </p>
              </td>
              <td v-for="(cell, i) in tier.cells" :key="packages[i].package_id" class="px-3 py-3 whitespace-nowrap">
                <template v-if="cell.price_minor === null">
                  <span class="text-[11px] font-bold text-amber-600">unpriced</span>
                </template>
                <template v-else>
                  <p
                    class="font-bold"
                    :class="cell.below_cost ? 'text-red-600' : 'text-brand-dark'"
                  >
                    {{ money(cell.price_minor) }}
                  </p>
                  <p class="text-[10px]" :class="cell.margin_minor < 0 ? 'text-red-500' : 'text-muted'">
                    {{ percent(cell.margin_bps) }}
                    <span v-if="cell.source === 'custom'" class="text-sky-600">· set</span>
                  </p>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tier price editor -->
    <Teleport to="body">
      <div
        v-if="editingTier"
        class="fixed inset-0 z-50 flex justify-end bg-brand-dark/45 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="editingTier = null"
      >
        <div class="clay flex h-full w-full flex-col overflow-hidden rounded-l-3xl bg-surface sm:max-w-2xl">
          <div class="flex shrink-0 items-start justify-between gap-3 border-b border-brand/10 px-5 py-4">
            <div>
              <p class="font-heading text-sm font-bold text-brand-dark">
                {{ editingTier.account_type.name }} prices
              </p>
              <p class="mt-0.5 text-[11px] text-muted">
                Saved together. A blank falls back to the tier rule rather than pricing at zero.
              </p>
            </div>
            <button type="button" class="shrink-0 text-muted transition hover:text-brand" aria-label="Close" @click="editingTier = null">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto px-5 py-3">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="text-[10px] font-extrabold tracking-widest text-muted uppercase">
                  <th class="py-2">Package</th>
                  <th class="py-2 text-right">Cost</th>
                  <th class="py-2 text-right">Now</th>
                  <th class="py-2 text-right">Margin</th>
                  <th class="w-28 py-2 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(cell, i) in editingTier.cells" :key="packages[i].package_id" class="border-t border-brand/5">
                  <td class="py-2 pr-2">
                    <p class="font-bold text-brand-dark">{{ packages[i].package }}</p>
                    <p class="text-[10px] text-muted">{{ packages[i].network }}</p>
                  </td>
                  <td class="py-2 text-right text-[11px] text-muted">
                    {{ packages[i].provider_cost_minor === null ? '—' : money(packages[i].provider_cost_minor) }}
                  </td>
                  <td class="py-2 text-right text-[11px] font-semibold text-brand-dark">
                    {{ cell.price_minor === null ? '—' : money(cell.price_minor) }}
                  </td>
                  <td class="py-2 text-right text-[11px]" :class="cell.margin_minor < 0 ? 'text-red-600' : 'text-emerald-600'">
                    {{ percent(cell.margin_bps) }}
                  </td>
                  <td class="py-2 pl-2">
                    <div class="flex items-center gap-1">
                      <input
                        v-model="draft[packages[i].package_id]"
                        type="number"
                        step="0.01"
                        min="0"
                        :placeholder="cell.custom_price_minor !== null ? '' : 'default'"
                        class="clay-well w-full rounded-lg bg-bg px-2 py-1.5 text-right text-xs font-semibold text-brand-dark outline-none"
                      />
                      <button
                        v-if="cell.custom_price_minor !== null"
                        type="button"
                        class="shrink-0 rounded-lg px-1.5 py-1 text-[10px] font-bold text-slate-400 transition hover:text-red-500"
                        title="Remove this override"
                        @click="clearOverride(packages[i].package_id)"
                      >
                        <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="flex shrink-0 items-center justify-between gap-3 border-t border-brand/10 px-5 py-4">
            <p class="text-[11px] text-muted">
              {{ editingTier.custom_overrides }} set price{{ editingTier.custom_overrides === 1 ? '' : 's' }} on this tier
            </p>
            <div class="flex gap-2">
              <button type="button" class="clay-btn-light rounded-xl bg-surface px-4 py-2.5 text-xs font-bold text-brand-dark" @click="editingTier = null">
                Cancel
              </button>
              <button
                type="button"
                :disabled="saving || !isDirty"
                class="clay-btn rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                @click="save"
              >
                {{ saving ? 'Saving…' : isDirty ? 'Save prices' : 'No changes' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
