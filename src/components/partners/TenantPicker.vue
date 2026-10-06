<script setup>
/**
 * Partner picker: type to search, click or press Enter to choose.
 *
 * The native <select> this replaces had two faults. It only ever offered the
 * first 100 partners, because the backend caps per_page there, so partner 400
 * was simply unreachable; and a native option is clipped to the width of the
 * control, so two partners with similar long names were indistinguishable.
 *
 * Search is server-side on name, slug or email, debounced, so the list is
 * never a stale client-side copy of the first page. The chosen partner is kept
 * as a label on its own line rather than squeezed into one.
 */
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { partnerApi } from '../../services/partnerApi'

const props = defineProps({
  modelValue: { type: [Number, String], default: null },
  placeholder: { type: String, default: 'Search partners…' },
  // Panels that open on a partner list used to pick the first one themselves;
  // that now happens here, so their first render has a tenant to load for.
  autoSelectFirst: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'change', 'emptied'])

const root = ref(null)
const input = ref(null)
const query = ref('')
const open = ref(false)
const options = ref([])
const loading = ref(false)
const error = ref('')
const active = ref(-1)
let searchTimer = null

const labelOf = (tenant) => `${tenant.name} (${tenant.slug})`

const fetchList = async (q = '') => {
  loading.value = true
  error.value = ''
  try {
    const res = await partnerApi.getTenants({ q: q || undefined, per_page: 20 })
    options.value = res.data
    emit('emptied', !q && res.meta?.total === 0)
    if (props.autoSelectFirst && !props.modelValue && res.data.length) {
      choose(res.data[0], false)
    }
  } catch (err) {
    error.value = err?.message || 'Could not load partners.'
  } finally {
    loading.value = false
  }
}

const search = () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    fetchList(query.value.trim())
    active.value = -1
  }, 250)
}

const choose = (tenant, close = true) => {
  query.value = labelOf(tenant)
  emit('update:modelValue', tenant.id)
  emit('change', tenant)
  if (close) {
    open.value = false
    input.value?.blur()
  }
}

const onInput = () => {
  if (!open.value) open.value = true
  search()
}

const onKeydown = (event) => {
  if (event.key === 'Escape') {
    open.value = false
    return
  }
  if (!open.value && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
    open.value = true
    event.preventDefault()
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    active.value = Math.min(active.value + 1, options.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    active.value = Math.max(active.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const tenant = options.value[active.value]
    if (tenant) choose(tenant)
  }
}

const onDocumentClick = (event) => {
  if (open.value && root.value && !root.value.contains(event.target)) open.value = false
}

// The label is not in `options` when the panel arrives with a partner already
// selected (a remembered choice, an auto-selected first row), so it is fetched
// by id rather than left as an empty box.
watch(
  () => props.modelValue,
  async (id) => {
    if (!id) {
      query.value = ''
      return
    }
    if (options.value.some((tenant) => tenant.id === id)) return
    try {
      const res = await partnerApi.getTenant(id)
      if (res.data && props.modelValue === res.data.id) query.value = labelOf(res.data)
    } catch {
      /* the id stays visible in the field rather than a wrong label */
      query.value = `Partner #${id}`
    }
  },
  { immediate: true },
)

watch(open, (isOpen) => {
  if (isOpen && !options.value.length && !loading.value) fetchList(query.value.trim())
  if (isOpen) nextTick(() => input.value?.select())
})

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  // Preload: the dropdown is ready on first open, and a panel that expects a
  // partner to be selected gets one without the operator having to click.
  fetchList('')
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  clearTimeout(searchTimer)
})
</script>

<template>
  <div ref="root" class="relative">
    <div class="relative">
      <input
        ref="input"
        :value="query"
        type="text"
        role="combobox"
        :aria-expanded="open"
        aria-controls="tenant-picker-list"
        :placeholder="placeholder"
        :disabled="disabled"
        autocomplete="off"
        class="clay-well w-full rounded-xl bg-bg px-3 py-2 pr-8 text-xs font-semibold text-brand-dark outline-none placeholder:font-medium placeholder:text-muted/50"
        @input="onInput"
        @focus="open = true"
        @keydown="onKeydown"
      />
      <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
        <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </span>
    </div>

    <div v-if="error" class="mt-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold text-red-600">
      <span>{{ error }}</span>
      <button type="button" class="font-extrabold underline" @click="fetchList(query.trim())">Retry</button>
    </div>

    <div
      v-if="open"
      id="tenant-picker-list"
      role="listbox"
      class="clay absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl bg-surface p-1 shadow-lg"
    >
      <p v-if="loading" class="px-3 py-2.5 text-[11px] text-muted">Searching…</p>
      <template v-else>
        <button
          v-for="(tenant, index) in options"
          :key="tenant.id"
          type="button"
          role="option"
          :aria-selected="tenant.id === modelValue"
          class="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition"
          :class="index === active ? 'bg-brand/10' : 'hover:bg-brand/5'"
          @mouseenter="active = index"
          @click="choose(tenant)"
        >
          <span class="min-w-0">
            <span class="block truncate text-xs font-bold text-brand-dark">{{ tenant.name }}</span>
            <span class="block truncate font-mono text-[10px] text-muted">{{ tenant.slug }} · {{ tenant.email }}</span>
          </span>
          <span
            v-if="tenant.id === modelValue"
            class="shrink-0 rounded-full bg-brand/10 px-1.5 py-0.5 text-[9px] font-extrabold tracking-widest text-brand uppercase"
          >
            Selected
          </span>
        </button>

        <p v-if="!options.length" class="px-3 py-2.5 text-[11px] text-muted">
          No partners match “{{ query }}”.
        </p>
      </template>
    </div>
  </div>
</template>
