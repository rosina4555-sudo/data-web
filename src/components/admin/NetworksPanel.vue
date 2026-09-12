<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '../../services/api'
import { formatDate } from '../../utils/format'
import { toast } from '../../services/toast'

const rows = ref([])
const loading = ref(true)
const loadError = ref('')
const editing = ref(null) // { mode:'create'|'edit', id?, code, name, is_active }
const busy = ref(false)

const load = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const res = await adminApi.getNetworks({ per_page: 100 })
    rows.value = res.data || []
  } catch (err) {
    loadError.value = err?.message || 'Failed to load networks.'
    toast(loadError.value, 'error')
  } finally {
    loading.value = false
  }
}

const fresh = () => ({ mode: 'create', code: '', name: '', is_active: true })

const startCreate = () => (editing.value = fresh())
const startEdit = (n) => (editing.value = { mode: 'edit', id: n.id, code: n.code, name: n.name, is_active: !!n.is_active })
const cancel = () => (editing.value = null)

const save = async () => {
  if (!editing.value?.code.trim() || !editing.value?.name.trim()) {
    toast('Code and name are required.', 'error')
    return
  }
  busy.value = true
  const payload = { code: editing.value.code.trim(), name: editing.value.name.trim(), is_active: editing.value.is_active }
  try {
    if (editing.value.mode === 'create') {
      await adminApi.createNetwork(payload)
      toast('Network created.', 'success')
    } else {
      await adminApi.updateNetwork(editing.value.id, payload)
      toast('Network updated.', 'success')
    }
    cancel()
    await load()
  } catch (err) {
    toast(err?.message || 'Save failed.', 'error')
  } finally {
    busy.value = false
  }
}

const toggle = async (n) => {
  try {
    await adminApi.updateNetwork(n.id, { is_active: !n.is_active })
    toast(`${n.name} ${n.is_active ? 'disabled' : 'enabled'}.`, 'success')
    await load()
  } catch (err) {
    toast(err?.message || 'Update failed.', 'error')
  }
}

const del = async (n) => {
  if (!window.confirm(`Delete network ${n.code}? This cannot be undone.`)) return
  try {
    await adminApi.deleteNetwork(n.id)
    toast('Network deleted.', 'success')
    await load()
  } catch (err) {
    toast(err?.message || 'Delete failed.', 'error')
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Networks</h1>
        <p class="text-xs font-medium text-muted">{{ rows.length }} networks</p>
      </div>
      <button type="button" class="clay-btn rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-xs font-extrabold text-white transition" @click="startCreate">+ Add network</button>
    </div>

    <!-- Create / edit form -->
    <div v-if="editing" class="clay rounded-3xl bg-surface p-4 sm:p-5">
      <p class="font-heading mb-3 text-sm font-bold text-brand-dark">{{ editing.mode === 'create' ? 'New network' : 'Edit ' + editing.code }}</p>
      <div class="flex flex-col gap-2.5 sm:flex-row sm:items-end">
        <label class="sm:w-28">
          <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Code</span>
          <input v-model="editing.code" type="text" maxlength="20" placeholder="MTN" class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 text-sm font-bold text-brand-dark outline-none placeholder:text-muted/40" />
        </label>
        <label class="flex-1">
          <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Name</span>
          <input v-model="editing.name" type="text" placeholder="MTN Ghana" class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 text-sm font-medium text-brand-dark outline-none placeholder:text-muted/40" />
        </label>
        <label class="flex items-center gap-2 pb-2 text-xs font-semibold text-brand-dark">
          <input v-model="editing.is_active" type="checkbox" class="h-4 w-4 accent-brand" />
          Active
        </label>
        <div class="flex gap-2">
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

    <!-- Grid -->
    <div v-else-if="rows.length" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
      <div v-for="n in rows" :key="n.id" class="clay flex flex-col rounded-3xl bg-surface p-4">
        <div class="flex items-center justify-between gap-2">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-sm font-black text-white">{{ n.code.slice(0, 2) }}</span>
          <span class="rounded-full px-2.5 py-1 text-[10px] font-extrabold" :class="n.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">{{ n.is_active ? 'Active' : 'Disabled' }}</span>
        </div>
        <h3 class="mt-3 font-heading text-base font-bold text-brand-dark">{{ n.name }}</h3>
        <p class="text-xs text-muted">{{ n.code }} · {{ n.packages_count ?? 0 }} bundles · since {{ formatDate(n.created_at) }}</p>
        <div class="mt-4 flex gap-2">
          <button type="button" class="clay-btn-light flex-1 rounded-xl bg-surface py-2 text-xs font-bold text-brand transition hover:bg-brand-soft" @click="startEdit(n)">Edit</button>
          <button type="button" :disabled="!n.is_active" class="flex-1 rounded-xl bg-brand-soft py-2 text-xs font-bold text-brand transition hover:bg-brand/10 disabled:opacity-40" @click="toggle(n)">{{ n.is_active ? 'Disable' : '—' }}</button>
          <button type="button" class="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100" @click="del(n)">Del</button>
        </div>
      </div>
    </div>

    <div v-else class="clay rounded-3xl bg-surface py-12 text-center">
      <p class="font-heading text-base font-bold text-brand-dark/70">No networks yet</p>
      <p class="mt-1 text-sm text-muted">Create your first network (e.g. MTN).</p>
    </div>
  </div>
</template>