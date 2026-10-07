<script setup>
/**
 * The create-password gate — everything a freshly created tenant sees.
 *
 * A partner admin creates a tenant with no password, so the first sign-in is
 * the email alone. That session is deliberately almost powerless: the server
 * refuses every route except reading and updating the profile, so this screen
 * is the only thing that can render until a password exists. Choosing one
 * flips `must_set_password` off and the ordinary dashboard takes over — no
 * reload, no second sign-in.
 */
import { ref } from 'vue'
import { tenantApi, setTenantProfile } from '../../services/tenantApi'
import { toast } from '../../services/toast'
import Logo from '../Logo.vue'

const emit = defineEmits(['password-set'])

const password = ref('')
const confirm = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

const submit = async () => {
  if (loading.value) return
  error.value = ''

  if (password.value.length < 8) {
    error.value = 'Your password needs at least 8 characters.'
    return
  }
  if (password.value !== confirm.value) {
    error.value = 'The two passwords do not match.'
    return
  }

  loading.value = true
  try {
    // No current_password: there is nothing to prove against, and the server
    // only skips that check exactly while the account has no password.
    const res = await tenantApi.updateProfile({ password: password.value })
    const tenant = res.data || res
    setTenantProfile(tenant)
    toast('Password created — welcome to your dashboard', 'success')
    emit('password-set', tenant)
  } catch (err) {
    error.value = err?.message || 'Could not save your password. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center px-4 py-10 text-ink">
    <div class="mb-6 flex flex-col items-center gap-2">
      <Logo :size="40" :text-class="'text-2xl font-heading font-bold tracking-tight'" />
      <p class="text-xs font-semibold tracking-widest text-muted uppercase">Partner dashboard</p>
    </div>

    <form class="clay w-full max-w-sm rounded-3xl bg-surface p-6 sm:p-8" @submit.prevent="submit">
      <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">
        Create your password
      </h1>
      <p class="mt-1 text-xs text-muted">
        Your account is ready — this is the only thing left before your dashboard opens.
        Choose a password you'll use to sign in from now on.
      </p>

      <div class="mt-5 space-y-4">
        <label class="block">
          <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">New password</span>
          <span class="relative block">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              autofocus
              minlength="8"
              required
              class="clay-well w-full rounded-2xl bg-bg px-4 py-3 pr-11 text-sm font-medium text-brand-dark outline-none transition placeholder:text-muted/40 focus:bg-surface"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted transition hover:text-brand"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              <svg v-if="!showPassword" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg v-else class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-10-7-10-7a13.16 13.16 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a13.16 13.16 0 0 1-2.13 2.85"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            </button>
          </span>
        </label>

        <label class="block">
          <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Confirm password</span>
          <input
            v-model="confirm"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            minlength="8"
            required
            class="clay-well w-full rounded-2xl bg-bg px-4 py-3 text-sm font-medium text-brand-dark outline-none transition placeholder:text-muted/40 focus:bg-surface"
          />
        </label>

        <p v-if="error" class="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-600">
          {{ error }}
        </p>
      </div>

      <button
        type="submit"
        :disabled="loading"
        class="mt-6 w-full rounded-2xl bg-gradient-to-r from-brand to-brand-dark py-3 text-sm font-bold text-white shadow-md shadow-brand/25 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {{ loading ? 'Saving…' : 'Create password & open dashboard' }}
      </button>

      <p class="mt-4 text-center text-[11px] text-muted">
        At least 8 characters. You can change it later from Profile.
      </p>
    </form>
  </div>
</template>
