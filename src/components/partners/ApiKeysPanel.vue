<script setup>
/**
 * Partner API keys.
 *
 * The secret is shown exactly once. This panel makes that unmissable: a modal
 * that will not close until it has been copied, and a note saying plainly that
 * support cannot recover it. Everything after issuance is the prefix.
 *
 * Revoke is immediate and irreversible — a key with `wallet:topup` can move money
 * out of a partner's wallet the moment it is compromised, so it does not wait
 * for a confirmation dialog the way a low-stakes form would.
 */
import { ref } from 'vue'
import { partnerApi } from '../../services/partnerApi'
import { toast } from '../../services/toast'
import { formatDateTime } from '../../utils/format'
import LoadError from '../LoadError.vue'
import TenantPicker from './TenantPicker.vue'

const ALL_SCOPES = [
  { id: 'catalog:read', label: 'Read catalogue', hint: 'List packages and prices' },
  { id: 'orders:read', label: 'Read orders', hint: 'Track their own orders' },
  { id: 'orders:write', label: 'Place orders', hint: 'Buy on their behalf' },
  { id: 'wallet:read', label: 'Read wallet', hint: 'Balance and ledger' },
  { id: 'wallet:topup', label: 'Top up wallet', hint: 'Adds credit — treat as money' },
]

const tenantId = ref(null)
const noTenants = ref(false)
const keys = ref([])
const loading = ref(false)
const error = ref('')

const issuing = ref(false)
const form = ref({ label: '', scopes: ['catalog:read', 'orders:read'], expires_at: '', ip_allowlist: '' })

const issuedSecret = ref(null)
const copied = ref(false)

const loadKeys = async () => {
  if (!tenantId.value) {
    keys.value = []
    return
  }
  loading.value = true
  error.value = ''
  try {
    const res = await partnerApi.getApiKeys(tenantId.value)
    keys.value = res.data
  } catch (err) {
    error.value = err?.message || 'Could not load API keys.'
  } finally {
    loading.value = false
  }
}

const toggleScope = (scope) => {
  const list = form.value.scopes
  form.value.scopes = list.includes(scope) ? list.filter((s) => s !== scope) : [...list, scope]
}

const issue = async () => {
  if (issuing.value) return
  if (!form.value.scopes.length) {
    toast('Pick at least one scope', 'error')
    return
  }
  issuing.value = true
  try {
    const res = await partnerApi.issueApiKey(tenantId.value, {
      label: form.value.label || 'partner key',
      scopes: form.value.scopes,
      expires_at: form.value.expires_at || null,
      ip_allowlist: form.value.ip_allowlist
        ? form.value.ip_allowlist.split(/[\s,]+/).filter(Boolean)
        : [],
    })
    issuedSecret.value = res.data
    copied.value = false
    form.value = { label: '', scopes: ['catalog:read', 'orders:read'], expires_at: '', ip_allowlist: '' }
    loadKeys()
  } catch (err) {
    toast(err?.message || 'Could not issue a key.', 'error')
  } finally {
    issuing.value = false
  }
}

const revoke = async (key) => {
  if (
    !window.confirm(
      `Revoke "${key.label}"?\n\n` +
        `Any integration still using it stops working immediately. This cannot be undone — ` +
        `issue a new key instead.`,
    )
  ) {
    return
  }
  try {
    await partnerApi.revokeApiKey(key.id)
    toast('Key revoked', 'success')
    loadKeys()
  } catch (err) {
    toast(err?.message || 'Could not revoke that key.', 'error')
  }
}

const copySecret = async () => {
  try {
    await navigator.clipboard.writeText(issuedSecret.value.secret)
    copied.value = true
  } catch {
    toast('Copy failed — select the secret and copy it manually.', 'error')
  }
}

const closeSecret = () => {
  issuedSecret.value = null
  copied.value = false
}
</script>

<template>
  <div class="space-y-5">
    <div class="clay flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-surface p-4 sm:p-5">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">API keys</h1>
        <p class="mt-0.5 text-xs text-muted">
          Keys are per partner. Give each integration its own key and its own scope set, so
          one can be revoked without taking the others offline.
        </p>
      </div>
      <label class="block min-w-56">
        <span class="mb-1 block text-[10px] font-bold tracking-widest text-muted uppercase">Partner</span>
        <TenantPicker v-model="tenantId" auto-select-first @change="loadKeys" @emptied="noTenants = $event" />
      </label>
    </div>

    <LoadError :error="error" :busy="loading" @retry="loadKeys" />

    <template v-if="tenantId">
      <div class="clay rounded-2xl bg-surface p-4 sm:p-5">
        <h2 class="font-heading text-sm font-bold tracking-tight text-brand-dark">Issue a key</h2>
        <div class="mt-3 grid gap-3 lg:grid-cols-2">
          <div class="space-y-3">
            <label class="block">
              <span class="mb-1 block text-xs font-bold text-brand-dark/70">Label</span>
              <input
                v-model="form.label"
                class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 text-sm outline-none"
                placeholder="Production checkout"
              />
              <span class="mt-1 block text-[10px] text-muted">
                Names the integration, so it is obvious later which one to revoke.
              </span>
            </label>
            <div class="grid grid-cols-2 gap-3">
              <label class="block">
                <span class="mb-1 block text-xs font-bold text-brand-dark/70">Expires (optional)</span>
                <input v-model="form.expires_at" type="datetime-local" class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 text-xs outline-none" />
              </label>
              <label class="block">
                <span class="mb-1 block text-xs font-bold text-brand-dark/70">IP allowlist (optional)</span>
                <input v-model="form.ip_allowlist" class="clay-well w-full rounded-xl bg-bg px-3 py-2.5 font-mono text-xs outline-none" placeholder="102.68.1.4, 102.68.1.5" />
              </label>
            </div>
          </div>

          <fieldset>
            <legend class="mb-1 text-xs font-bold text-brand-dark/70">Scopes</legend>
            <label
              v-for="scope in ALL_SCOPES"
              :key="scope.id"
              class="flex cursor-pointer items-start gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-brand/[0.04]"
            >
              <input
                type="checkbox"
                class="mt-0.5 h-3.5 w-3.5 accent-[--brand]"
                :checked="form.scopes.includes(scope.id)"
                @change="toggleScope(scope.id)"
              />
              <span class="min-w-0">
                <span class="block text-xs font-bold text-brand-dark">{{ scope.label }}</span>
                <span class="block font-mono text-[10px] text-muted">{{ scope.id }} — {{ scope.hint }}</span>
              </span>
            </label>
          </fieldset>
        </div>

        <button
          type="button"
          :disabled="issuing"
          class="clay-btn mt-4 rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
          @click="issue"
        >
          {{ issuing ? 'Issuing…' : 'Issue key' }}
        </button>
      </div>

      <p v-if="loading" class="clay rounded-2xl bg-surface py-10 text-center text-xs text-muted">Loading…</p>

      <p v-else-if="!keys.length" class="clay rounded-2xl bg-surface py-10 text-center text-xs text-muted">
        No keys for this partner yet.
      </p>

      <template v-else>
        <!-- Desktop table -->
        <div class="clay hidden overflow-hidden rounded-2xl bg-surface lg:block">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="border-b border-brand/10 bg-bg/60 text-[10px] font-extrabold tracking-widest text-muted uppercase">
                  <th class="px-4 py-3">Key</th>
                  <th class="px-4 py-3">Prefix</th>
                  <th class="px-4 py-3">Scopes</th>
                  <th class="px-4 py-3">State</th>
                  <th class="px-4 py-3">Last used</th>
                  <th class="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="key in keys" :key="key.id" class="border-b border-brand/5 last:border-0">
                  <td class="px-4 py-3 font-bold text-brand-dark">{{ key.label }}</td>
                  <td class="px-4 py-3 font-mono text-[11px] text-muted">{{ key.key_prefix }}</td>
                  <td class="px-4 py-3">
                    <span class="flex flex-wrap gap-1">
                      <span
                        v-for="s in key.scopes"
                        :key="s"
                        class="rounded-md bg-brand/5 px-1.5 py-0.5 font-mono text-[10px] font-semibold"
                        :class="s === 'wallet:topup' || s === 'orders:write' ? 'text-amber-700' : 'text-muted'"
                      >{{ s }}</span>
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <span
                      class="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                      :class="key.revoked_at ? 'bg-slate-100 text-slate-500' : key.usable ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'"
                    >
                      {{ key.revoked_at ? 'Revoked' : key.usable ? 'Live' : 'Expired' }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-[11px] text-muted">
                    {{ key.last_used_at ? formatDateTime(key.last_used_at) : 'Never' }}
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button
                      v-if="!key.revoked_at"
                      type="button"
                      class="rounded-lg px-2 py-1 text-[11px] font-bold text-red-500 transition hover:bg-red-50"
                      @click="revoke(key)"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Mobile cards: scopes and state are the point of this list, and
             neither survives a six-column table squeezed onto a phone. -->
        <ul class="space-y-3 lg:hidden">
          <li v-for="key in keys" :key="key.id" class="clay rounded-2xl bg-surface p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate font-heading text-sm font-bold text-brand-dark">{{ key.label }}</p>
                <p class="mt-0.5 truncate font-mono text-[10px] text-muted">
                  {{ key.key_prefix }} · {{ key.last_used_at ? 'last used ' + formatDateTime(key.last_used_at) : 'never used' }}
                </p>
              </div>
              <span
                class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                :class="key.revoked_at ? 'bg-slate-100 text-slate-500' : key.usable ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'"
              >
                {{ key.revoked_at ? 'Revoked' : key.usable ? 'Live' : 'Expired' }}
              </span>
            </div>
            <div class="mt-2 flex flex-wrap gap-1">
              <span
                v-for="s in key.scopes"
                :key="s"
                class="rounded-md bg-brand/5 px-1.5 py-0.5 font-mono text-[10px] font-semibold"
                :class="s === 'wallet:topup' || s === 'orders:write' ? 'text-amber-700' : 'text-muted'"
              >{{ s }}</span>
            </div>
            <div v-if="!key.revoked_at" class="mt-3 flex justify-end border-t border-brand/5 pt-2.5">
              <button
                type="button"
                class="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-red-500 transition hover:bg-red-50"
                @click="revoke(key)"
              >
                Revoke
              </button>
            </div>
          </li>
        </ul>
      </template>
    </template>

    <p v-else-if="noTenants" class="rounded-2xl bg-surface py-10 text-center text-xs text-muted">
      Create a partner first, then issue each integration its own key.
    </p>
    <p v-else-if="!tenantId" class="rounded-2xl bg-surface py-10 text-center text-xs text-muted">
      Pick a partner above to see their keys.
    </p>

    <!-- The one-time secret -->
    <Teleport to="body">
      <div
        v-if="issuedSecret"
        class="fixed inset-0 z-50 flex items-center justify-center bg-brand-dark/60 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
      >
        <div class="clay w-full max-w-md rounded-3xl bg-surface p-6">
          <h2 class="font-heading text-base font-bold tracking-tight text-brand-dark">Copy this secret now</h2>
          <p class="mt-1 text-xs text-muted">
            It is not stored anywhere we can read it back, and support cannot recover it. If it
            is lost, revoke this key and issue another.
          </p>

          <div class="mt-4 rounded-2xl bg-brand-dark p-4">
            <p class="font-mono text-xs leading-relaxed break-all text-white">{{ issuedSecret.secret }}</p>
          </div>

          <button
            type="button"
            class="clay-btn mt-4 w-full rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2.5 text-xs font-bold text-white"
            @click="copySecret"
          >
            {{ copied ? 'Copied to clipboard' : 'Copy secret' }}
          </button>
          <button
            type="button"
            class="mt-2 w-full rounded-xl px-4 py-2 text-xs font-bold text-muted transition hover:text-brand"
            @click="closeSecret"
          >
            {{ copied ? 'Done' : 'I have copied it somewhere safe' }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
