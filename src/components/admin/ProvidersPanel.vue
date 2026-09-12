<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '../../services/api'
import { formatDateTime } from '../../utils/format'
import { toast } from '../../services/toast'

const rows = ref([])
const ppRows = ref([])
const loading = ref(true)
const loadError = ref('')
const syncing = ref({})

const load = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const [prov, pp] = await Promise.all([
      adminApi.getProviders({ per_page: 100 }),
      adminApi.getProviderPackages({ per_page: 300 }),
    ])
    rows.value = prov.data || []
    ppRows.value = pp.data || []
  } catch (err) {
    loadError.value = err?.message || 'Failed to load providers.'
    toast(loadError.value, 'error')
  } finally {
    loading.value = false
  }
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

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Providers</h1>
      <p class="text-xs font-medium text-muted">{{ rows.length }} gateways · {{ ppRows.length }} synced bundles</p>
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

        <button
          type="button"
          :disabled="syncing[p.id]"
          class="clay-btn mt-3.5 w-full rounded-xl bg-gradient-to-r from-brand to-brand-dark py-2.5 text-xs font-extrabold text-white transition disabled:opacity-50"
          @click="sync(p)"
        >
          {{ syncing[p.id] ? 'Syncing…' : `↻ Sync catalogue (${p.adapter_key})` }}
        </button>
      </div>
    </div>

    <div v-else class="clay rounded-3xl bg-surface py-12 text-center">
      <p class="font-heading text-base font-bold text-brand-dark/70">No providers yet</p>
      <p class="mt-1 text-sm text-muted">Add a provider from the backend seed CLI.</p>
    </div>
  </div>
</template>