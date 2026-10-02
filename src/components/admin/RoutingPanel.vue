<script setup>
import { ref, computed, onMounted } from 'vue'
import { adminApi } from '../../services/api'
import { toast } from '../../services/toast'

const networks = ref([])
const loading = ref(true)
const loadError = ref('')
const dirty = ref({})
const saving = ref({})

const load = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const res = await adminApi.getRouting()
    networks.value = res.data?.networks || []
  } catch (err) {
    loadError.value = err?.message || 'Failed to load routing.'
    toast(loadError.value, 'error')
  } finally {
    loading.value = false
  }
}

const move = (network, index, dir) => {
  const target = index + dir
  if (target < 0 || target >= network.providers.length) return
  const providers = [...network.providers]
  ;[providers[index], providers[target]] = [providers[target], providers[index]]
  network.providers = providers.map((p, i) => ({ ...p, sort_order: i, primary: i === 0 }))
  dirty.value[network.id] = true
}

const save = async (network) => {
  saving.value[network.id] = true
  try {
    const res = await adminApi.updateRouting(network.id, network.providers.map((p) => p.id))
    network.providers = res.data?.providers || network.providers
    dirty.value[network.id] = false
    toast(`Routing saved for ${network.name}.`, 'success')
  } catch (err) {
    toast(err?.message || `Saving routing for ${network.name} failed.`, 'error')
  } finally {
    saving.value[network.id] = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Routing</h1>
        <p class="text-xs font-medium text-muted">Per-network provider order: the first is primary, the rest are auto-fallbacks when fulfillment fails.</p>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand/15 border-t-brand"></div>
    </div>

    <div v-else-if="loadError" class="clay flex items-center justify-center gap-3 rounded-3xl bg-surface py-10 text-center">
      <p class="text-sm font-semibold text-red-600">{{ loadError }}</p>
      <button type="button" class="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100" @click="load">Retry</button>
    </div>

    <div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      <div v-if="!networks.length" class="clay col-span-full rounded-3xl bg-surface py-12 text-center">
        <p class="font-heading text-base font-bold text-brand-dark/70">No networks yet</p>
        <p class="mt-1 text-sm text-muted">Create a network from the Networks tab first.</p>
      </div>

      <div v-for="network in networks" :key="network.id" class="clay flex flex-col rounded-3xl bg-surface p-4">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="rounded-lg bg-brand-soft px-2 py-0.5 text-[10px] font-extrabold text-brand">{{ network.code }}</span>
            <h3 class="font-heading text-sm font-bold text-brand-dark">{{ network.name }}</h3>
          </div>
          <span v-if="!network.providers?.length" class="text-[11px] font-semibold text-amber-600">No providers</span>
        </div>

        <div v-if="network.providers?.length" class="mt-3 space-y-2">
          <div
            v-for="(p, index) in network.providers"
            :key="p.id"
            class="rounded-2xl border p-3"
            :class="p.primary ? 'border-brand/20 bg-brand-soft/60' : 'border-brand/10 bg-surface'"
          >
            <div class="flex items-center gap-2.5">
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold"
                :class="p.primary ? 'bg-gradient-to-br from-brand to-brand-dark text-white' : 'bg-slate-100 text-slate-500'"
              >
                {{ index + 1 }}
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <p class="truncate text-sm font-bold text-brand-dark">{{ p.name }}</p>
                  <span class="rounded-full px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide uppercase" :class="p.primary ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                    {{ p.primary ? 'Primary' : 'Fallback' }}
                  </span>
                </div>
                <p class="text-[11px] font-medium text-muted">{{ p.adapter_key }} · {{ p.package_count }} bundles</p>
              </div>
              <div class="flex flex-col gap-0.5">
                <button
                  type="button"
                  :disabled="index === 0"
                  class="rounded-md px-1.5 py-0.5 text-slate-400 transition hover:bg-brand/10 hover:text-brand disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Move up"
                  @click="move(network, index, -1)"
                >
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                </button>
                <button
                  type="button"
                  :disabled="index === network.providers.length - 1"
                  class="rounded-md px-1.5 py-0.5 text-slate-400 transition hover:bg-brand/10 hover:text-brand disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Move down"
                  @click="move(network, index, 1)"
                >
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="mt-3 rounded-2xl border border-dashed border-brand/20 py-6 text-center">
          <p class="text-xs font-medium text-muted">Sync a provider catalogue to enable ordering.</p>
        </div>

        <button
          v-if="network.providers?.length"
          type="button"
          :disabled="!dirty[network.id] || saving[network.id]"
          class="clay-btn mt-3.5 w-full rounded-xl py-2.5 text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-40"
          :class="dirty[network.id] ? 'bg-gradient-to-r from-brand to-brand-dark text-white' : 'bg-slate-100 text-slate-500'"
          @click="save(network)"
        >
          {{ saving[network.id] ? 'Saving…' : dirty[network.id] ? '● Save routing' : 'Saved' }}
        </button>
      </div>
    </div>
  </div>
</template>