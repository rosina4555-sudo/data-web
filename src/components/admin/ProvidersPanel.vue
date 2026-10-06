<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '../../services/api'
import { formatDateTime } from '../../utils/format'
import { toast } from '../../services/toast'
import Pagination from './Pagination.vue'

const rows = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0 })
const ppRows = ref([])
const loading = ref(true)
const loadError = ref('')
const syncing = ref({})

const load = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const [prov, pp] = await Promise.all([
      adminApi.getProviders({ page: meta.value.current_page, per_page: 20 }),
      adminApi.getProviderPackages({ per_page: 300 }),
    ])
    rows.value = prov.data || []
    meta.value = prov.meta || meta.value
    ppRows.value = pp.data || []
  } catch (err) {
    loadError.value = err?.message || 'Failed to load providers.'
    toast(loadError.value, 'error')
  } finally {
    loading.value = false
  }
}

const page = (p) => {
  meta.value.current_page = p
  load()
}

const sync = async (p) => {
  syncing.value[p.id] = true
  try {
    const res = await adminApi.syncProvider(p.id)
    const d = res.data || res
    toast(`Synced ${p.name}: ${d.inserted ?? 0} new, ${d.updated ?? 0} updated, ${d.total ?? '?'} total.`, 'success')
    await load()
  } catch (err) {
    toast(err?.message || `Sync of ${p.name} failed.`, 'error')
  } finally {
    syncing.value[p.id] = false
  }
}

const packagesFor = (providerId) => ppRows.value.filter((pp) => pp.provider_id === providerId)

const networks = ref([])
const editing = ref(null) // { mode:'create'|'edit', id?, name, adapter_key, base_url, is_active }
const assigning = ref(null) // { id, name, ids: [] }
const busy = ref(false)

const loadNetworks = async () => {
  try {
    const res = await adminApi.getNetworks({ per_page: 100 })
    networks.value = res.data || []
  } catch {
    /* the assignment dialog reports it if it opens on an empty list */
  }
}

const startCreate = () => {
  editing.value = { mode: 'create', name: '', adapter_key: '', base_url: '', is_active: true }
}

const startEdit = (p) => {
  editing.value = {
    mode: 'edit',
    id: p.id,
    name: p.name,
    adapter_key: p.adapter_key,
    base_url: p.base_url || '',
    is_active: !!p.is_active,
  }
}

const cancel = () => (editing.value = null)

const save = async () => {
  const form = editing.value
  if (!form) return
  if (!form.name.trim() || !form.adapter_key.trim()) {
    toast('Name and adapter key are required.', 'error')
    return
  }
  busy.value = true
  const payload = {
    name: form.name.trim(),
    adapter_key: form.adapter_key.trim(),
    base_url: form.base_url.trim(),
    is_active: form.is_active,
  }
  try {
    if (form.mode === 'create') {
      await adminApi.createProvider(payload)
      toast('Provider added. Assign its networks, then sync its catalogue.', 'success')
    } else {
      await adminApi.updateProvider(form.id, payload)
      toast('Provider updated.', 'success')
    }
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
    await adminApi.updateProvider(p.id, { is_active: !p.is_active })
    toast(`${p.name} ${p.is_active ? 'disabled' : 'enabled'}.`, 'success')
    await load()
  } catch (err) {
    toast(err?.message || 'Update failed.', 'error')
  }
}

const del = async (p) => {
  if (!window.confirm(`Delete provider ${p.name}? This cannot be undone.`)) return
  try {
    await adminApi.deleteProvider(p.id)
    toast('Provider deleted.', 'success')
    await load()
  } catch (err) {
    // 409 with "Provider has packages; disable it instead" is the expected
    // answer for anything already synced, and it is the useful one to show.
    toast(err?.message || 'Delete failed.', 'error')
  }
}

const openAssign = (p) => {
  assigning.value = { id: p.id, name: p.name, ids: (p.networks || []).map((n) => n.id) }
  if (!networks.value.length) loadNetworks()
}

const saveAssign = async () => {
  if (!assigning.value) return
  busy.value = true
  try {
    await adminApi.syncProviderNetworks(assigning.value.id, assigning.value.ids)
    toast('Networks updated.', 'success')
    assigning.value = null
    await load()
  } catch (err) {
    toast(err?.message || 'Could not save networks.', 'error')
  } finally {
    busy.value = false
  }
}

const toggleNetwork = (networkId) => {
  const ids = assigning.value.ids
  assigning.value.ids = ids.includes(networkId) ? ids.filter((id) => id !== networkId) : [...ids, networkId]
}

onMounted(() => {
  load()
  loadNetworks()
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Providers</h1>
        <p class="text-xs font-medium text-muted">{{ meta.total }} gateways · {{ ppRows.length }} synced bundles</p>
      </div>
      <button
        type="button"
        class="clay-btn rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-xs font-extrabold text-white transition"
        @click="startCreate"
      >
        + Add provider
      </button>
    </div>

    <!-- Create / edit form -->
    <div v-if="editing" class="clay rounded-3xl bg-surface p-4 sm:p-5">
      <p class="font-heading mb-3 text-sm font-bold text-brand-dark">
        {{ editing.mode === 'create' ? 'New provider' : 'Edit ' + editing.name }}
      </p>
      <div class="flex flex-col gap-2.5 sm:flex-row sm:items-end">
        <label class="sm:w-44">
          <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Name</span>
          <input
            v-model="editing.name"
            type="text"
            maxlength="100"
            placeholder="Hubtel"
            class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 text-sm font-medium text-brand-dark outline-none placeholder:text-muted/40"
          />
        </label>
        <label class="sm:w-44">
          <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Adapter key</span>
          <input
            v-model="editing.adapter_key"
            type="text"
            maxlength="50"
            placeholder="hubtel"
            class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 font-mono text-sm font-semibold text-brand-dark outline-none placeholder:text-muted/40"
          />
          <span class="mt-1 block text-[10px] text-muted">Must match an adapter registered in the backend.</span>
        </label>
        <label class="flex-1">
          <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Base URL</span>
          <input
            v-model="editing.base_url"
            type="text"
            maxlength="255"
            placeholder="https://api.example.com"
            class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 font-mono text-sm text-brand-dark outline-none placeholder:text-muted/40"
          />
        </label>
        <label class="flex items-center gap-2 pb-2 text-xs font-semibold text-brand-dark">
          <input v-model="editing.is_active" type="checkbox" class="h-4 w-4 accent-brand" />
          Active
        </label>
        <div class="flex gap-2">
          <button
            type="button"
            :disabled="busy"
            class="clay-btn rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2.5 text-xs font-extrabold text-white transition disabled:opacity-50"
            @click="save"
          >
            {{ busy ? 'Saving…' : 'Save' }}
          </button>
          <button
            type="button"
            class="clay-btn-light rounded-xl bg-surface px-3 py-2.5 text-xs font-bold text-muted transition hover:text-brand"
            @click="cancel"
          >
            Cancel
          </button>
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

    <div v-else-if="rows.length" class="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
      <div v-for="p in rows" :key="p.id" class="clay flex flex-col rounded-3xl bg-surface p-4">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-extrabold text-brand uppercase">{{ p.adapter_key }}</span>
              <span class="rounded-full px-2 py-0.5 text-[10px] font-extrabold" :class="p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">{{ p.is_active ? 'Active' : 'Disabled' }}</span>
            </div>
            <h3 class="mt-2 font-heading text-base font-bold text-brand-dark">{{ p.name }}</h3>
          </div>
          <svg class="h-6 w-6 shrink-0 text-brand/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
        </div>

        <p v-if="p.base_url" class="mt-1 truncate text-xs font-mono text-muted">{{ p.base_url }}</p>

        <div class="mt-2.5 flex flex-wrap gap-1.5">
          <span v-for="n in p.networks" :key="p.id + '-' + n.id" class="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-extrabold text-accent-dark">{{ n.code }}</span>
          <span v-if="!p.networks?.length" class="text-[11px] text-muted/60">No linked networks</span>
        </div>

        <div class="mt-3 border-t border-brand/10 pt-3">
          <p class="text-[10px] font-bold tracking-widest text-muted uppercase">Synced bundles · {{ packagesFor(p.id).length }}</p>
          <ul class="mt-1.5 max-h-28 space-y-1 overflow-y-auto hide-scrollbar">
            <li v-for="pp in packagesFor(p.id).slice(0, 10)" :key="pp.id" class="flex items-center justify-between gap-2 text-[11px]">
              <span class="truncate font-semibold text-brand-dark">{{ pp.name }}</span>
              <span class="shrink-0 font-mono text-muted">#{{ pp.provider_reference }}</span>
            </li>
            <li v-if="!packagesFor(p.id).length" class="text-[11px] text-muted/60">Run a sync to pull the provider catalogue.</li>
          </ul>
        </div>

        <div class="mt-3.5 flex gap-2">
          <button
            type="button"
            class="clay-btn-light flex-1 rounded-xl bg-surface py-2 text-xs font-bold text-brand transition hover:bg-brand-soft"
            @click="startEdit(p)"
          >
            Edit
          </button>
          <button
            type="button"
            class="clay-btn-light flex-1 rounded-xl bg-surface py-2 text-xs font-bold text-brand transition hover:bg-brand-soft"
            @click="openAssign(p)"
          >
            Networks
          </button>
          <button
            type="button"
            class="flex-1 rounded-xl bg-brand-soft py-2 text-xs font-bold text-brand transition hover:bg-brand/10"
            @click="toggle(p)"
          >
            {{ p.is_active ? 'Disable' : 'Enable' }}
          </button>
          <button
            type="button"
            class="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100"
            @click="del(p)"
          >
            Del
          </button>
        </div>

        <button
          type="button"
          :disabled="syncing[p.id]"
          class="clay-btn mt-2 w-full rounded-xl bg-gradient-to-r from-brand to-brand-dark py-2.5 text-xs font-extrabold text-white transition disabled:opacity-50"
          @click="sync(p)"
        >
          {{ syncing[p.id] ? 'Syncing…' : `↻ Sync catalogue (${p.adapter_key})` }}
        </button>
      </div>
    </div>

    <div v-else class="clay rounded-3xl bg-surface py-12 text-center">
      <p class="font-heading text-base font-bold text-brand-dark/70">No providers yet</p>
      <p class="mt-1 text-sm text-muted">Add a provider, link its networks, then sync its catalogue.</p>
    </div>

    <!-- Network assignment -->
    <Teleport to="body">
      <div
        v-if="assigning"
        class="fixed inset-0 z-50 flex items-end justify-center bg-brand-dark/45 backdrop-blur-sm sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        @click.self="assigning = null"
      >
        <div class="clay w-full max-w-md rounded-t-3xl bg-surface p-5 sm:rounded-3xl">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="font-heading text-sm font-bold text-brand-dark">Networks for {{ assigning.name }}</p>
              <p class="mt-0.5 text-[11px] text-muted">
                These are the networks this gateway is allowed to fulfil. Saving replaces the set.
              </p>
            </div>
            <button
              type="button"
              class="text-muted transition hover:text-brand"
              aria-label="Close"
              @click="assigning = null"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <div v-if="!networks.length" class="mt-4 rounded-xl bg-bg px-4 py-6 text-center text-xs text-muted">
            No networks loaded.
            <button type="button" class="ml-1 font-bold text-brand underline" @click="loadNetworks">Retry</button>
          </div>

          <div v-else class="mt-4 flex flex-wrap gap-2">
            <button
              v-for="n in networks"
              :key="n.id"
              type="button"
              class="rounded-full border px-3 py-1.5 text-[11px] font-extrabold transition"
              :class="assigning.ids.includes(n.id) ? 'border-brand bg-brand-soft text-brand' : 'border-brand/15 bg-bg text-muted hover:text-brand-dark'"
              @click="toggleNetwork(n.id)"
            >
              {{ n.code }}
            </button>
          </div>

          <div class="mt-5 flex gap-2">
            <button
              type="button"
              :disabled="busy || !networks.length"
              class="clay-btn flex-1 rounded-xl bg-gradient-to-r from-brand to-brand-dark py-2.5 text-xs font-extrabold text-white transition disabled:opacity-50"
              @click="saveAssign"
            >
              {{ busy ? 'Saving…' : 'Save networks' }}
            </button>
            <button
              type="button"
              class="clay-btn-light rounded-xl bg-surface px-4 py-2.5 text-xs font-bold text-muted transition hover:text-brand"
              @click="assigning = null"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Pagination :page="meta.current_page" :total-pages="meta.last_page" :total="meta.total" @update:page="page" />
  </div>
</template>