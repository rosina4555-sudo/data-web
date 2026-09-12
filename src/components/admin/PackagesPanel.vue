<script setup>
import { ref, computed, onMounted } from 'vue'
import { adminApi } from '../../services/api'
import { currency, formatDate } from '../../utils/format'
import { toast } from '../../services/toast'
import Pagination from './Pagination.vue'

const rows = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const networks = ref([])
const providerPackages = ref([])
const loading = ref(true)
const loadError = ref('')
const networkFilter = ref('')
const busy = ref(false)
const editing = ref(null)

const load = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const params = { page: meta.value.current_page, per_page: 20 }
    if (networkFilter.value) params.network_id = networkFilter.value
    const [pkgRes, netRes, ppRes] = await Promise.all([
      adminApi.getPackages(params),
      adminApi.getNetworks({ per_page: 100 }),
      adminApi.getProviderPackages({ per_page: 500 }),
    ])
    rows.value = pkgRes.data || []
    meta.value = pkgRes.meta || meta.value
    networks.value = netRes.data || []
    providerPackages.value = ppRes.data || []
  } catch (err) {
    loadError.value = err?.message || 'Failed to load bundles.'
    toast(loadError.value, 'error')
  } finally {
    loading.value = false
  }
}

const page = (p) => {
  meta.value.current_page = p
  load()
}

const fresh = () => ({ mode: 'create', network_id: '', provider_package_id: '', name: '', sell_price: '', sort_order: 0, is_active: true })
const startCreate = () => (editing.value = fresh())
const startEdit = (p) =>
  (editing.value = {
    mode: 'edit',
    id: p.id,
    network_id: String(p.network_id ?? ''),
    provider_package_id: String(p.provider_package_id ?? ''),
    name: p.name,
    sell_price: p.sell_price,
    sort_order: p.sort_order ?? 0,
    is_active: !!p.is_active,
  })
const cancel = () => (editing.value = null)

const networkOptions = computed(() => networks.value)
const providerPackageOptions = computed(() =>
  editing.value?.network_id
    ? providerPackages.value.filter((pp) => String(pp.network_id) === String(editing.value.network_id) && pp.is_active)
    : providerPackages.value,
)

const save = async () => {
  const e = editing.value
  if (!e.network_id || !e.provider_package_id || !e.name.trim() || !e.sell_price) {
    toast('Fill in network, provider bundle, name and price.', 'error')
    return
  }
  busy.value = true
  const payload = {
    network_id: Number(e.network_id),
    provider_package_id: Number(e.provider_package_id),
    name: e.name.trim(),
    sell_price: String(Number(e.sell_price).toFixed(2)),
    is_active: e.is_active,
    sort_order: Number(e.sort_order || 0),
  }
  try {
    if (e.mode === 'create') await adminApi.createPackage(payload)
    else await adminApi.updatePackage(e.id, payload)
    toast('Bundle saved.', 'success')
    cancel()
    await load()
  } catch (err) {
    toast(err?.message || 'Save failed.', 'error')
  } finally {
    busy.value = false
  }
}

const toggle = async (p) => {
  try {
    await adminApi.updatePackage(p.id, { is_active: !p.is_active })
    toast(`${p.name} ${p.is_active ? 'hidden' : 'listed'}.`, 'success')
    await load()
  } catch (err) {
    toast(err?.message || 'Update failed.', 'error')
  }
}

const changeNetworkFilter = () => {
  meta.value = { current_page: 1, last_page: 1, total: 0 }
  load()
}

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Bundles</h1>
        <p class="text-xs font-medium text-muted">{{ meta.total }} listed</p>
      </div>
      <div class="flex items-center gap-2">
        <select v-model="networkFilter" class="clay-well rounded-xl bg-surface px-3 py-2 text-xs font-semibold text-brand-dark outline-none" @change="changeNetworkFilter">
          <option value="">All networks</option>
          <option v-for="n in networks" :key="n.id" :value="String(n.id)">{{ n.code }}</option>
        </select>
        <button type="button" class="clay-btn rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-xs font-extrabold text-white transition" @click="startCreate">+ Add bundle</button>
      </div>
    </div>

    <!-- Create / edit -->
    <div v-if="editing" class="clay rounded-3xl bg-surface p-4 sm:p-5">
      <p class="font-heading mb-3 text-sm font-bold text-brand-dark">{{ editing.mode === 'create' ? 'New bundle' : 'Edit ' + editing.name }}</p>
      <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <label class="col-span-1">
          <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Network</span>
          <select v-model="editing.network_id" class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 text-sm font-semibold text-brand-dark outline-none" @change="editing.provider_package_id = ''">
            <option value="" disabled>Select…</option>
            <option v-for="n in networkOptions" :key="n.id" :value="String(n.id)">{{ n.code }}</option>
          </select>
        </label>
        <label class="col-span-2 sm:col-span-1">
          <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Provider bundle</span>
          <select v-model="editing.provider_package_id" class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 text-sm font-semibold text-brand-dark outline-none">
            <option value="" disabled>{{ editing.network_id ? 'Select…' : 'Pick network first' }}</option>
            <option v-for="pp in providerPackageOptions" :key="pp.id" :value="String(pp.id)">
              {{ pp.name }} ({{ pp.provider?.name || '?' }} · ref {{ pp.provider_reference }})
            </option>
          </select>
        </label>
        <label class="col-span-2">
          <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Display name</span>
          <input v-model="editing.name" type="text" placeholder="MTN GH 1GB" class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 text-sm font-medium text-brand-dark outline-none placeholder:text-muted/40" />
        </label>
        <label>
          <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Price (₵)</span>
          <input v-model="editing.sell_price" type="number" step="0.01" min="0" inputmode="decimal" class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 text-sm font-bold text-brand-dark outline-none" />
        </label>
        <label>
          <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Sort order</span>
          <input v-model="editing.sort_order" type="number" step="1" class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 text-sm font-medium text-brand-dark outline-none" />
        </label>
        <label class="flex items-end gap-2 pb-2.5 text-xs font-semibold text-brand-dark">
          <input v-model="editing.is_active" type="checkbox" class="h-4 w-4 accent-brand" />
          Listed
        </label>
        <div class="flex items-end gap-2">
          <button type="button" :disabled="busy" class="clay-btn rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2.5 text-xs font-extrabold text-white transition disabled:opacity-50" @click="save">{{ busy ? 'Saving…' : 'Save' }}</button>
          <button type="button" class="clay-btn-light rounded-xl bg-surface px-3 py-2.5 text-xs font-bold text-muted transition hover:text-brand" @click="cancel">Cancel</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand/15 border-t-brand"></div>
    </div>

    <div v-else-if="loadError" class="clay flex items-center justify-center gap-3 rounded-3xl bg-surface py-10 text-center">
      <p class="text-sm font-semibold text-red-600">{{ loadError }}</p>
      <button type="button" class="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100" @click="load">Retry</button>
    </div>

    <div v-else-if="rows.length" class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 lg:gap-4">
      <div v-for="p in rows" :key="p.id" class="clay flex flex-col rounded-3xl bg-surface p-4">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-extrabold text-brand">{{ p.network?.code }}</span>
              <span class="rounded-full px-2 py-0.5 text-[10px] font-extrabold" :class="p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">{{ p.is_active ? 'Live' : 'Hidden' }}</span>
            </div>
            <h3 class="mt-2 truncate font-heading text-base font-bold text-brand-dark">{{ p.name }}</h3>
          </div>
          <p class="shrink-0 font-heading text-lg font-black text-brand">{{ currency(p.sell_price) }}</p>
        </div>
        <p class="mt-1 text-xs text-muted">
          {{ p.provider_package?.size_label || '' }} · via {{ p.provider_package?.provider?.name || '—' }} (ref {{ p.provider_package?.provider_reference || '—' }})
        </p>
        <p class="mt-0.5 text-[11px] text-muted/70">Sort {{ p.sort_order ?? 0 }} · since {{ formatDate(p.created_at) }}</p>
        <div class="mt-4 flex gap-2">
          <button type="button" class="clay-btn-light flex-1 rounded-xl bg-surface py-2 text-xs font-bold text-brand transition hover:bg-brand-soft" @click="startEdit(p)">Edit</button>
          <button type="button" class="flex-1 rounded-xl bg-brand-soft py-2 text-xs font-bold text-brand transition hover:bg-brand/10" @click="toggle(p)">{{ p.is_active ? 'Hide' : 'Show' }}</button>
        </div>
      </div>
    </div>

    <div v-else class="clay rounded-3xl bg-surface py-12 text-center">
      <p class="font-heading text-base font-bold text-brand-dark/70">No bundles{{ networkFilter ? ' for this network' : '' }}</p>
      <p class="mt-1 text-sm text-muted">Add your first bundle to start selling.</p>
    </div>

    <Pagination :page="meta.current_page" :total-pages="meta.last_page" :total="meta.total" @update:page="page" />
  </div>
</template>