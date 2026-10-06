<script setup>
/**
 * Partner list, creation, and the drill-down sheet.
 *
 * Creation lives here rather than in the sheet because a partner cannot be edited
 * until it exists, and the sheet is only reachable from a row.
 */
import { ref, onMounted, watch } from 'vue'
import { partnerApi } from '../../services/partnerApi'
import { toast } from '../../services/toast'
import { tenantStatusMeta, money } from '../../utils/partners'
import Pagination from '../admin/Pagination.vue'
import TenantSheet from './TenantSheet.vue'
import LoadError from '../LoadError.vue'

const tenants = ref([])
const tiers = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0, per_page: 15 })
const page = ref(1)
const status = ref('')
const q = ref('')
const loading = ref(true)
const error = ref('')

const showCreate = ref(false)
const creating = ref(false)
const form = ref({ name: '', slug: '', email: '', phone: '', account_type_id: '', min_topup_minor: 1000 })
const createErrors = ref({})

const openTenantId = ref(null)

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await partnerApi.getTenants({
      page: page.value,
      per_page: 15,
      status: status.value || undefined,
      q: q.value || undefined,
    })
    tenants.value = res.data
    meta.value = res.meta
  } catch (err) {
    error.value = err?.message || 'Could not load partners.'
  } finally {
    loading.value = false
  }
}

const loadTiers = async () => {
  try {
    const res = await partnerApi.getAccountTypes()
    tiers.value = res.data.filter((t) => t.is_active)
    if (!form.value.account_type_id && tiers.value.length) {
      form.value.account_type_id = tiers.value[0].id
    }
  } catch {
    /* the create form degrades to "pick a tier" with nothing in it */
  }
}

// Retry covers both loads: the tier picker behind "New partner" fails silently
// on its own, and retrying only the list would leave that form empty with a
// green-looking panel.
const reload = async () => {
  await Promise.all([load(), loadTiers()])
}

watch([page, status], load)
onMounted(() => {
  load()
  loadTiers()
})

const submitCreate = async () => {
  if (creating.value) return
  creating.value = true
  createErrors.value = {}
  try {
    await partnerApi.createTenant({
      ...form.value,
      account_type_id: Number(form.value.account_type_id),
      min_topup_minor: Number(form.value.min_topup_minor) || 0,
    })
    toast('Partner created', 'success')
    showCreate.value = false
    form.value = { name: '', slug: '', email: '', phone: '', account_type_id: tiers.value[0]?.id ?? '', min_topup_minor: 1000 }
    page.value = 1
    load()
  } catch (err) {
    // Backend 422s carry a field=>message map; surfacing it per field is far more
    // useful than one toast saying "Validation failed".
    const detail = err?.message || ''
    createErrors.value = { form: detail }
    toast(detail, 'error')
  } finally {
    creating.value = false
  }
}

const suspend = async (tenant) => {
  const reason = window.prompt(`Why are you suspending ${tenant.name}?`)
  if (reason === null) return
  try {
    await partnerApi.suspendTenant(tenant.id, reason)
    toast(`${tenant.name} suspended`, 'success')
    load()
  } catch (err) {
    toast(err?.message || 'Could not suspend.', 'error')
  }
}

const activate = async (tenant) => {
  try {
    await partnerApi.activateTenant(tenant.id)
    toast(`${tenant.name} reactivated`, 'success')
    load()
  } catch (err) {
    toast(err?.message || 'Could not reactivate.', 'error')
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="clay flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-surface p-4 sm:p-5">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Partners</h1>
        <p class="mt-0.5 text-xs text-muted">
          Suspending stops a partner buying and topping up. It does not touch their balance —
          they still own it, and their refunds still land.
        </p>
      </div>
      <button
        type="button"
        class="clay-btn rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-xs font-bold text-white"
        @click="showCreate = true"
      >
        New partner
      </button>
    </div>

    <div class="clay flex flex-wrap items-end gap-2 rounded-2xl bg-surface p-4">
      <label class="block flex-1 min-w-48">
        <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Search</span>
        <input
          v-model="q"
          type="search"
          placeholder="Name, slug or email"
          class="clay-well w-full rounded-xl bg-bg px-3 py-2 text-xs font-medium text-brand-dark outline-none"
          @keyup.enter="((page = 1), load())"
        />
      </label>
      <label class="block">
        <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Status</span>
        <select
          v-model="status"
          class="clay-well rounded-xl bg-bg px-3 py-2 text-xs font-medium text-brand-dark outline-none"
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="closed">Closed</option>
        </select>
      </label>
      <button
        type="button"
        class="clay-btn-light rounded-xl bg-surface px-4 py-2 text-xs font-bold text-brand-dark"
        @click="((page = 1), load())"
      >
        Search
      </button>
    </div>

    <LoadError :error="error" :busy="loading" @retry="reload" />

    <div class="clay overflow-hidden rounded-2xl bg-surface">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-brand/10 bg-bg/60 text-[10px] font-extrabold tracking-widest text-muted uppercase">
              <th class="px-4 py-3">Partner</th>
              <th class="px-4 py-3">Tier</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3 text-right">Balance</th>
              <th class="px-4 py-3">Refund policy</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="t in tenants"
              :key="t.id"
              class="cursor-pointer border-b border-brand/5 transition last:border-0 hover:bg-brand/[0.03]"
              @click="openTenantId = t.id"
            >
              <td class="px-4 py-3">
                <p class="font-bold text-brand-dark">{{ t.name }}</p>
                <p class="font-mono text-[10px] text-muted">{{ t.slug }} · {{ t.email }}</p>
              </td>
              <td class="px-4 py-3 text-muted">{{ t.account_type?.code || '—' }}</td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                  :class="tenantStatusMeta(t.status).cls"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-current opacity-70"></span>
                  {{ tenantStatusMeta(t.status).label }}
                </span>
              </td>
              <td class="px-4 py-3 text-right font-semibold">
                {{ t.wallet ? money(t.wallet.balance_minor) : '—' }}
              </td>
              <td class="px-4 py-3">
                <span v-if="t.auto_refund_on_failure" class="text-[11px] font-semibold text-emerald-600">
                  Auto · after {{ t.auto_refund_after_minutes }}m
                </span>
                <span v-else class="text-[11px] text-muted">Manual</span>
              </td>
              <td class="px-4 py-3 text-right" @click.stop>
                <button
                  v-if="t.status === 'active'"
                  type="button"
                  class="rounded-lg px-2 py-1 text-[11px] font-bold text-amber-600 transition hover:bg-amber-50"
                  @click="suspend(t)"
                >
                  Suspend
                </button>
                <button
                  v-else-if="t.status === 'suspended'"
                  type="button"
                  class="rounded-lg px-2 py-1 text-[11px] font-bold text-emerald-600 transition hover:bg-emerald-50"
                  @click="activate(t)"
                >
                  Reactivate
                </button>
                <span v-else class="text-[11px] text-muted">Closed</span>
              </td>
            </tr>
                        <tr v-if="loading">
              <td colspan="6" class="px-4 py-8 text-center text-xs text-muted">Loading…</td>
            </tr>
<tr v-if="!loading && !tenants.length">
              <td colspan="6" class="px-4 py-8 text-center text-xs text-muted">
                No partners match that filter.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="px-4 pb-3">
        <Pagination v-model:page="page" :total-pages="meta.last_page" :total="meta.total" />
      </div>
    </div>

    <TenantSheet
      v-if="openTenantId"
      :tenant-id="openTenantId"
      :tiers="tiers"
      @close="openTenantId = null"
      @changed="load"
    />

    <!-- Create partner -->
    <Teleport to="body">
      <div
        v-if="showCreate"
        class="fixed inset-0 z-50 flex items-end justify-center bg-brand-dark/45 backdrop-blur-sm sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        @click.self="showCreate = false"
      >
        <div class="clay flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface sm:max-w-lg sm:rounded-3xl">
          <div class="flex shrink-0 items-center justify-between border-b border-brand/10 px-5 py-4">
            <p class="font-heading text-sm font-bold text-brand-dark">New partner</p>
            <button type="button" class="text-muted transition hover:text-brand" aria-label="Close" @click="showCreate = false">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <form class="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4" @submit.prevent="submitCreate">
            <label class="block">
              <span class="mb-1 block text-xs font-bold text-brand-dark/70">Name</span>
              <input v-model="form.name" required class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 text-sm outline-none" placeholder="Acme Data Ltd" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-bold text-brand-dark/70">Slug</span>
              <input v-model="form.slug" required pattern="[a-z0-9-]+" class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 font-mono text-sm outline-none" placeholder="acme" />
              <span class="mt-1 block text-[10px] text-muted">
                Appears in partner-facing references and cannot be changed later.
              </span>
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-bold text-brand-dark/70">Email</span>
              <input v-model="form.email" type="email" required class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 text-sm outline-none" placeholder="ops@acme.test" />
            </label>
            <div class="grid grid-cols-2 gap-3">
              <label class="block">
                <span class="mb-1 block text-xs font-bold text-brand-dark/70">Phone</span>
                <input v-model="form.phone" class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 text-sm outline-none" placeholder="0245000000" />
              </label>
              <label class="block">
                <span class="mb-1 block text-xs font-bold text-brand-dark/70">Min top-up (pesewa)</span>
                <input v-model="form.min_topup_minor" type="number" min="0" step="1" class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 text-sm outline-none" />
              </label>
            </div>
            <label class="block">
              <span class="mb-1 block text-xs font-bold text-brand-dark/70">Tier</span>
              <select v-model="form.account_type_id" required class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 text-sm outline-none">
                <option v-for="t in tiers" :key="t.id" :value="t.id">{{ t.name }} ({{ t.code }})</option>
              </select>
            </label>
            <p v-if="createErrors.form" class="text-xs font-semibold text-red-600">{{ createErrors.form }}</p>
          </form>

          <div class="flex shrink-0 gap-2 border-t border-brand/10 px-5 py-4">
            <button type="button" class="clay-btn-light flex-1 rounded-xl bg-surface px-4 py-2.5 text-xs font-bold text-brand-dark" @click="showCreate = false">
              Cancel
            </button>
            <button
              type="button"
              :disabled="creating"
              class="clay-btn flex-1 rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
              @click="submitCreate"
            >
              {{ creating ? 'Creating…' : 'Create partner' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
