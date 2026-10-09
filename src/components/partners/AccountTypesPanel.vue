<script setup>
/**
 * Tier management: create, edit, retire.
 *
 * Two rules this screen exists to make obvious:
 *  - A tier is never deleted. It is deactivated, because orders and settlements
 *    still reference it and a hard delete would leave them unexplained. The
 *    backend enforces this; the button says so before it sends the request.
 *  - Every tier carries a price grid, so a tier that has never been priced will
 *    reject orders. The column shows the coverage rather than letting an
 *    operator discover it at checkout.
 */
import { ref, onMounted } from 'vue'
import { partnerApi } from '../../services/partnerApi'
import { toast } from '../../services/toast'
import { money } from '../../utils/partners'
import { formatDateTime } from '../../utils/format'
import LoadError from '../LoadError.vue'

const tiers = ref([])
const loading = ref(true)
const error = ref('')

const editing = ref(null)
const saving = ref(false)

const blank = () => ({
  name: '',
  code: '',
  description: '',
  min_topup_minor: 1000,
  is_default: false,
  is_active: true,
  sort_order: 0,
  markup_bps: 0,
})

const draft = ref(blank())

const openCreate = () => {
  editing.value = 'new'
  draft.value = blank()
}

const openEdit = (tier) => {
  editing.value = tier.id
  draft.value = {
    name: tier.name,
    code: tier.code,
    description: tier.description || '',
    min_topup_minor: tier.min_topup_minor,
    is_default: tier.is_default,
    is_active: tier.is_active,
    sort_order: tier.sort_order,
    markup_bps: tier.markup_bps,
  }
}

const close = () => {
  editing.value = null
}

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await partnerApi.getAccountTypes()
    tiers.value = res.data
  } catch (err) {
    error.value = err?.message || 'Could not load tiers.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const save = async () => {
  if (saving.value) return
  saving.value = true
  const body = {
    ...draft.value,
    min_topup_minor: Number(draft.value.min_topup_minor) || 0,
    sort_order: Number(draft.value.sort_order) || 0,
    markup_bps: Number(draft.value.markup_bps) || 0,
  }
  try {
    if (editing.value === 'new') {
      await partnerApi.createAccountType(body)
      toast('Tier created — now price it on the Pricing tab', 'success')
    } else {
      await partnerApi.updateAccountType(editing.value, body)
      toast('Tier updated', 'success')
    }
    close()
    load()
  } catch (err) {
    toast(err?.message || 'Could not save the tier.', 'error')
  } finally {
    saving.value = false
  }
}

const toggleActive = async (tier) => {
  try {
    await partnerApi.updateAccountType(tier.id, { ...tier, is_active: !tier.is_active })
    toast(tier.is_active ? `${tier.name} deactivated` : `${tier.name} activated`, 'success')
    load()
  } catch (err) {
    toast(err?.message || 'Could not change that tier.', 'error')
  }
}

const retire = async (tier) => {
  if (
    !window.confirm(
      `Delete "${tier.name}"?\n\n` +
        `This is only possible while no partner is on this tier. If any partner is, ` +
        `deactivate the tier instead — their orders and settlements still reference it.`,
    )
  ) {
    return
  }
  try {
    await partnerApi.deleteAccountType(tier.id)
    toast('Tier deleted', 'success')
    load()
  } catch (err) {
    toast(err?.message || 'Could not delete that tier.', 'error')
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="clay flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-surface p-4 sm:p-5">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Tiers</h1>
        <p class="mt-0.5 text-xs text-muted">
          A tier decides two things: what a partner pays for each package, and how much a
          single order is allowed to be.
        </p>
      </div>
      <button
        type="button"
        class="clay-btn rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-xs font-bold text-white"
        @click="openCreate"
      >
        New tier
      </button>
    </div>

    <LoadError :error="error" :busy="loading" @retry="load" />

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="tier in tiers"
        :key="tier.id"
        class="clay flex flex-col rounded-2xl bg-surface p-4"
        :class="tier.is_active ? '' : 'opacity-60'"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="truncate font-heading text-sm font-bold tracking-tight text-brand-dark">
              {{ tier.name }}
              <span v-if="tier.is_default" class="ml-1 rounded-full bg-brand/10 px-1.5 py-0.5 text-[9px] font-extrabold tracking-widest text-brand uppercase">
                Default
              </span>
            </h3>
            <p class="font-mono text-[10px] text-muted">{{ tier.code }}</p>
          </div>
          <span
            class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold"
            :class="tier.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'"
          >
            {{ tier.is_active ? 'Active' : 'Retired' }}
          </span>
        </div>

        <p v-if="tier.description" class="mt-2 line-clamp-2 text-[11px] text-ink/70">{{ tier.description }}</p>

        <dl class="mt-3 space-y-1.5 text-[11px]">
          <div class="flex justify-between">
            <dt class="text-muted">Min top-up</dt>
            <dd class="font-bold text-brand-dark">{{ money(tier.min_topup_minor) }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-muted">Mark-up</dt>
            <dd class="font-bold text-brand-dark">
              {{ tier.markup_bps ? `+${(tier.markup_bps / 100).toFixed(0)}%` : 'None' }}
            </dd>
          </div>
        </dl>

        <div class="mt-4 flex flex-wrap gap-1.5 border-t border-brand/10 pt-3">
          <button type="button" class="rounded-lg px-2 py-1 text-[11px] font-bold text-sky-700 transition hover:bg-sky-50" @click="openEdit(tier)">
            Edit
          </button>
          <button v-if="tier.is_active" type="button" class="rounded-lg px-2 py-1 text-[11px] font-bold text-ink/60 transition hover:bg-brand/5" @click="toggleActive(tier)">
            Deactivate
          </button>
          <button v-else type="button" class="rounded-lg px-2 py-1 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-50" @click="toggleActive(tier)">
            Reactivate
          </button>
          <button type="button" class="rounded-lg px-2 py-1 text-[11px] font-bold text-red-500 transition hover:bg-red-50" @click="retire(tier)">
            Delete
          </button>
        </div>
      </div>

      <div v-if="loading" class="sm:col-span-2 lg:col-span-3">
        <p class="rounded-2xl bg-surface py-10 text-center text-xs text-muted">Loading…</p>
      </div>
      <div v-else-if="!tiers.length" class="sm:col-span-2 lg:col-span-3">
        <p class="rounded-2xl bg-surface py-10 text-center text-xs text-muted">
          No tiers yet. Create one, then price it on the Pricing tab.
        </p>
      </div>
    </div>

    <!-- Editor -->
    <Teleport to="body">
      <div
        v-if="editing"
        class="fixed inset-0 z-50 flex items-end justify-center bg-brand-dark/45 backdrop-blur-sm sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        @click.self="close"
      >
        <div class="clay flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface sm:max-w-lg sm:rounded-3xl">
          <div class="flex shrink-0 items-center justify-between border-b border-brand/10 px-5 py-4">
            <p class="font-heading text-sm font-bold text-brand-dark">
              {{ editing === 'new' ? 'New tier' : 'Edit tier' }}
            </p>
            <button type="button" class="text-muted transition hover:text-brand" aria-label="Close" @click="close">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <form class="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4" @submit.prevent="save">
            <div class="grid grid-cols-2 gap-3">
              <label class="block">
                <span class="mb-1 block text-xs font-bold text-brand-dark/70">Name</span>
                <input v-model="draft.name" required class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 text-sm outline-none" placeholder="Gold" />
              </label>
              <label class="block">
                <span class="mb-1 block text-xs font-bold text-brand-dark/70">Code</span>
                <input v-model="draft.code" required :disabled="editing !== 'new'" class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 font-mono text-sm outline-none disabled:opacity-60" placeholder="gold" />
                <span v-if="editing !== 'new'" class="mt-1 block text-[10px] text-muted">The code cannot change once orders exist.</span>
              </label>
            </div>

            <label class="block">
              <span class="mb-1 block text-xs font-bold text-brand-dark/70">Description</span>
              <textarea v-model="draft.description" rows="2" class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 text-sm outline-none" placeholder="What this tier is for"></textarea>
            </label>

            <div class="grid grid-cols-2 gap-3">
              <label class="block">
                <span class="mb-1 block text-xs font-bold text-brand-dark/70">Min top-up (pesewa)</span>
                <input v-model="draft.min_topup_minor" type="number" min="0" step="1" class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 text-sm outline-none" />
              </label>
              <label class="block">
                <span class="mb-1 block text-xs font-bold text-brand-dark/70">Mark-up (bps)</span>
                <input v-model="draft.markup_bps" type="number" min="0" step="50" class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 text-sm outline-none" />
                <span class="mt-1 block text-[10px] text-muted">Added to provider cost when this tier prices from cost: 500 = +5%. 0 = none.</span>
              </label>
            </div>

            <div class="flex flex-wrap gap-4 pt-1">
              <label class="flex items-center gap-2 text-xs font-semibold text-brand-dark">
                <input v-model="draft.is_default" type="checkbox" class="h-3.5 w-3.5 accent-[--brand]" />
                Default for new partners
              </label>
              <label class="flex items-center gap-2 text-xs font-semibold text-brand-dark">
                <input v-model="draft.is_active" type="checkbox" class="h-3.5 w-3.5 accent-[--brand]" />
                Active
              </label>
              <label class="flex items-center gap-2 text-xs font-semibold text-brand-dark">
                <span class="sr-only">Sort order</span>
                <input v-model="draft.sort_order" type="number" class="h-8 w-20 clay-well rounded-lg bg-bg px-2 text-xs outline-none" />
                Sort order
              </label>
            </div>
          </form>

          <div class="flex shrink-0 gap-2 border-t border-brand/10 px-5 py-4">
            <button type="button" class="clay-btn-light flex-1 rounded-xl bg-surface px-4 py-2.5 text-xs font-bold text-brand-dark" @click="close">Cancel</button>
            <button
              type="button"
              :disabled="saving"
              class="clay-btn flex-1 rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
              @click="save"
            >
              {{ saving ? 'Saving…' : 'Save tier' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
