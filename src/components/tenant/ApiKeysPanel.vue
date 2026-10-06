<script setup>
/**
 * The partner's own API keys.
 *
 * A key can place orders and move wallet money, which is exactly why it is
 * issued here with a session: this screen is reachable only while somebody is
 * signed in as the tenant, and the key itself can never be used to mint
 * another — a leaked read-only credential must not escalate into ownership of
 * the account.
 *
 * No expiry or IP allowlist on this form: the endpoint takes label and scopes
 * only, and a control that silently did nothing would teach a partner that
 * restrictions they set are ignored.
 *
 * The secret is shown exactly once, in a modal that will not close until it has
 * been copied. Support cannot recover it, and the copy says so.
 */
import { ref, onMounted } from 'vue'
import { tenantApi } from '../../services/tenantApi'
import { toast } from '../../services/toast'
import { formatDateTime } from '../../utils/format'
import LoadError from '../LoadError.vue'

const SCOPES = [
  { id: 'catalog:read', label: 'Read catalogue', hint: 'List packages and prices' },
  { id: 'orders:read', label: 'Read orders', hint: 'Track the orders you placed' },
  { id: 'orders:write', label: 'Place orders', hint: 'Buy bundles from your wallet' },
  { id: 'wallet:read', label: 'Read wallet', hint: 'Balance and ledger' },
  { id: 'wallet:topup', label: 'Top up wallet', hint: 'Adds credit — treat as money' },
]

const keys = ref([])
const loading = ref(false)
const error = ref('')

const form = ref({ label: '', scopes: ['catalog:read', 'orders:read'] })
const issuing = ref(false)

const issuedSecret = ref(null)
const copied = ref(false)

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    keys.value = (await tenantApi.getApiKeys()).data
  } catch (err) {
    keys.value = []
    error.value = err?.message || 'Could not load your API keys.'
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
    const res = await tenantApi.issueApiKey({
      label: form.value.label.trim() || 'my integration',
      scopes: form.value.scopes,
    })
    issuedSecret.value = res.data
    copied.value = false
    form.value = { label: '', scopes: ['catalog:read', 'orders:read'] }
    load()
  } catch (err) {
    toast(err?.message || 'Could not issue that key.', 'error')
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
    await tenantApi.revokeApiKey(key.id)
    toast('Key revoked', 'success')
    load()
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

const stateOf = (key) =>
  key.revoked_at ? 'Revoked' : key.usable ? 'Live' : 'Expired'

const stateClass = (key) =>
  key.revoked_at
    ? 'bg-slate-100 text-slate-500'
    : key.usable
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-amber-50 text-amber-700'

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <div class="clay flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-surface p-4 sm:p-5">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">API keys</h1>
        <p class="mt-0.5 text-xs text-muted">
          For your own integrations. Give each one its own key and its own scopes, so one can be
          revoked without taking the others offline.
        </p>
      </div>
      <p class="max-w-xs text-[11px] text-muted">
        Signing in here never needs a key — keys are for servers and scripts, not for people.
      </p>
    </div>

    <LoadError :error="error" :busy="loading" @retry="load" />

    <div class="clay rounded-2xl bg-surface p-4 sm:p-5">
      <h2 class="font-heading text-sm font-bold tracking-tight text-brand-dark">Issue a key</h2>
      <div class="mt-3 grid gap-3 lg:grid-cols-2">
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

        <fieldset>
          <legend class="mb-1 text-xs font-bold text-brand-dark/70">Scopes</legend>
          <label
            v-for="scope in SCOPES"
            :key="scope.id"
            class="flex cursor-pointer items-start gap-2.5 rounded-xl px-2.5 py-1.5 transition hover:bg-brand/[0.04]"
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
      No keys yet. Issue one above when you have an integration ready.
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
                  <span class="rounded-full px-2 py-0.5 text-[10px] font-extrabold" :class="stateClass(key)">
                    {{ stateOf(key) }}
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
                  >Revoke</button>
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
            <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold" :class="stateClass(key)">
              {{ stateOf(key) }}
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
            >Revoke</button>
          </div>
        </li>
      </ul>
    </template>

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
