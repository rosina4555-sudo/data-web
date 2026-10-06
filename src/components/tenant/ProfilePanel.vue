<script setup>
/**
 * Profile — who this account is, and the two things a partner may change
 * about itself: how to reach it, and the password that gets in.
 *
 * Tier, status and limits are shown but not editable: those are the operator's
 * to set, and a dashboard that could raise its own tier would not need to be
 * breached to be a problem. `can_transact` is surfaced as a banner because a
 * partner staring at a refused purchase deserves the reason in front of them
 * rather than discovered one click later.
 */
import { ref, onMounted, computed } from 'vue'
import { tenantApi, getTenantProfile, setTenantProfile } from '../../services/tenantApi'
import { toast } from '../../services/toast'
import { money } from '../../utils/partners'
import { formatDate, formatDateTime } from '../../utils/format'
import LoadError from '../LoadError.vue'

const profile = ref(getTenantProfile())
const loading = ref(false)
const error = ref('')

const contact = ref({ name: '', email: '', phone: '' })
const savingContact = ref(false)

const pass = ref({ current_password: '', password: '', confirm: '' })
const savingPass = ref(false)

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    profile.value = (await tenantApi.getProfile()).data
    setTenantProfile(profile.value)
    contact.value = {
      name: profile.value.name || '',
      email: profile.value.email || '',
      phone: profile.value.phone || '',
    }
  } catch (err) {
    error.value = err?.message || 'Could not load your profile.'
  } finally {
    loading.value = false
  }
}

const saveContact = async () => {
  if (savingContact.value) return
  if (!contact.value.name.trim()) {
    toast('A business name is required', 'error')
    return
  }

  savingContact.value = true
  try {
    const res = await tenantApi.updateProfile({
      name: contact.value.name.trim(),
      email: contact.value.email.trim(),
      phone: contact.value.phone.trim() || undefined,
    })
    profile.value = res.data
    setTenantProfile(res.data)
    toast('Profile updated', 'success')
  } catch (err) {
    toast(err?.message || 'Could not save those details.', 'error')
  } finally {
    savingContact.value = false
  }
}

const savePassword = async () => {
  if (savingPass.value) return

  if (pass.value.password.length < 8) {
    toast('A new password needs at least 8 characters', 'error')
    return
  }
  if (pass.value.password !== pass.value.confirm) {
    toast('The two new passwords do not match', 'error')
    return
  }

  savingPass.value = true
  try {
    const res = await tenantApi.updateProfile({
      password: pass.value.password,
      current_password: pass.value.current_password || undefined,
    })
    profile.value = res.data
    setTenantProfile(res.data)
    pass.value = { current_password: '', password: '', confirm: '' }
    toast('Password changed', 'success')
  } catch (err) {
    toast(err?.message || 'Could not change that password.', 'error')
  } finally {
    savingPass.value = false
  }
}

const tierLabel = computed(
  () => profile.value?.account_type?.name || 'Retail pricing',
)

const limitsText = computed(() => {
  const limits = profile.value?.limits
  if (!limits) return []
  const out = []
  if (limits.rate_limit_per_min) out.push(`${limits.rate_limit_per_min} API calls / minute`)
  if (limits.daily_order_limit) out.push(`${limits.daily_order_limit} orders / day`)
  if (limits.min_balance_minor) out.push(`${money(limits.min_balance_minor)} reserve held`)
  if (limits.max_topup_minor) out.push(`${money(limits.max_topup_minor)} max top-up`)
  return out
})

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <div class="clay flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-surface p-4 sm:p-5">
      <div>
        <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Profile</h1>
        <p class="mt-0.5 text-xs text-muted">Your account details, tier and password.</p>
      </div>
      <span
        v-if="profile"
        class="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase"
        :class="profile.can_transact ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'"
      >
        {{ profile.can_transact ? 'Transacting' : 'Transacting paused' }}
      </span>
    </div>

    <LoadError :error="error" :busy="loading" @retry="load" />

    <p v-if="profile && !profile.can_transact" class="rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
      Purchases and top-ups are paused on this account. Everything else still works — contact
      support to have it reactivated.
    </p>

    <div class="grid gap-5 lg:grid-cols-2">
      <form class="clay rounded-2xl bg-surface p-4 sm:p-5" @submit.prevent="saveContact">
        <h2 class="font-heading text-sm font-bold tracking-tight text-brand-dark">Contact details</h2>

        <div class="mt-3 space-y-3">
          <label class="block">
            <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Business name</span>
            <input
              v-model="contact.name"
              class="clay-well w-full rounded-xl bg-bg px-3.5 py-2.5 text-sm outline-none"
              placeholder="Acme Payments Ltd"
            />
          </label>
          <label class="block">
            <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Sign-in email</span>
            <input
              v-model="contact.email"
              type="email"
              class="clay-well w-full rounded-xl bg-bg px-3.5 py-2.5 text-sm outline-none"
            />
            <span class="mt-1 block text-[10px] text-muted">This is the address you sign in with.</span>
          </label>
          <label class="block">
            <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Phone (optional)</span>
            <input
              v-model="contact.phone"
              inputmode="tel"
              class="clay-well w-full rounded-xl bg-bg px-3.5 py-2.5 text-sm outline-none"
              placeholder="024 000 0000"
            />
          </label>
        </div>

        <button
          type="submit"
          :disabled="savingContact"
          class="clay-btn mt-4 rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
        >
          {{ savingContact ? 'Saving…' : 'Save details' }}
        </button>
      </form>

      <div class="space-y-5">
        <form class="clay rounded-2xl bg-surface p-4 sm:p-5" @submit.prevent="savePassword">
          <h2 class="font-heading text-sm font-bold tracking-tight text-brand-dark">Change password</h2>

          <div class="mt-3 space-y-3">
            <label class="block">
              <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Current password</span>
              <input
                v-model="pass.current_password"
                type="password"
                autocomplete="current-password"
                class="clay-well w-full rounded-xl bg-bg px-3.5 py-2.5 text-sm outline-none"
              />
            </label>
            <label class="block">
              <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">New password</span>
              <input
                v-model="pass.password"
                type="password"
                autocomplete="new-password"
                class="clay-well w-full rounded-xl bg-bg px-3.5 py-2.5 text-sm outline-none"
              />
              <span class="mt-1 block text-[10px] text-muted">At least 8 characters.</span>
            </label>
            <label class="block">
              <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Repeat new password</span>
              <input
                v-model="pass.confirm"
                type="password"
                autocomplete="new-password"
                class="clay-well w-full rounded-xl bg-bg px-3.5 py-2.5 text-sm outline-none"
              />
            </label>
          </div>

          <button
            type="submit"
            :disabled="savingPass"
            class="clay-btn mt-4 rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
          >
            {{ savingPass ? 'Changing…' : 'Change password' }}
          </button>
        </form>

        <div v-if="profile" class="clay rounded-2xl bg-surface p-4 sm:p-5">
          <h2 class="font-heading text-sm font-bold tracking-tight text-brand-dark">Account</h2>
          <dl class="mt-3 space-y-2 text-xs">
            <div class="flex items-center justify-between gap-3">
              <dt class="text-muted">Tier</dt>
              <dd class="font-bold text-brand-dark">{{ tierLabel }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-muted">Status</dt>
              <dd class="font-bold capitalize text-brand-dark">{{ profile.status }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-muted">Partner since</dt>
              <dd class="text-ink/70">{{ formatDate(profile.created_at) }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-muted">Last sign-in</dt>
              <dd class="text-ink/70">{{ formatDateTime(profile.last_login_at) }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-muted">Wallet</dt>
              <dd class="font-bold text-brand-dark">
                {{ profile.wallet ? money(profile.wallet.balance_minor) : '—' }}
              </dd>
            </div>
          </dl>

          <p v-if="limitsText.length" class="mt-3 border-t border-brand/5 pt-3 text-[10px] leading-relaxed text-muted">
            {{ limitsText.join(' · ') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
