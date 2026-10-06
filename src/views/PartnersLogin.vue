<script setup>
import { ref } from 'vue'
import { partnerLogin } from '../services/partnerApi'
import { toast } from '../services/toast'
import Logo from '../components/Logo.vue'

const emit = defineEmits(['authenticated'])

const email = ref('')
const password = ref('')
const loading = ref(false)
const showPassword = ref(false)

// Set by the API wrapper when a session is dropped for lack of permission
// rather than for having expired — the operator is signed out here with the
// server's reason, instead of being left in a console of 403s.
const notice = ref(sessionStorage.getItem('dp_login_notice') || '')
sessionStorage.removeItem('dp_login_notice')

const submit = async () => {
  if (loading.value) return
  loading.value = true
  const res = await partnerLogin(email.value, password.value)
  loading.value = false
  if (res.ok) {
    toast('Signed in to the partner console', 'success')
    emit('authenticated')
    window.location.hash = '#/partners'
  } else {
    toast(res.error || 'Login failed', 'error')
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center px-4 py-10 text-ink">
    <div class="mb-6 flex flex-col items-center gap-2">
      <Logo :size="40" :text-class="'text-2xl font-heading font-bold tracking-tight'" />
      <p class="text-xs font-semibold tracking-widest text-muted uppercase">Partner console</p>
    </div>

    <form class="clay w-full max-w-sm rounded-3xl bg-surface p-6 sm:p-8" @submit.prevent="submit">
      <p v-if="notice" class="mb-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-700">
        {{ notice }}
      </p>

      <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Sign in</h1>
      <p class="mt-1 text-xs text-muted">
        Requires partner management permission. This is a separate console from the
        main admin panel and uses its own session.
      </p>

      <div class="mt-5 space-y-4">
        <label class="block">
          <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Email</span>
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            required
            placeholder="admin@datapadi.com"
            class="clay-well w-full rounded-2xl bg-bg px-4 py-3 text-sm font-medium text-brand-dark outline-none transition placeholder:text-muted/40 focus:bg-surface"
          />
        </label>

        <label class="block">
          <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Password</span>
          <span class="relative block">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
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
              <svg v-else class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-10-7-10-7a13.16 13.16 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            </button>
          </span>
        </label>
      </div>

      <button
        type="submit"
        :disabled="loading"
        class="mt-6 w-full rounded-2xl bg-gradient-to-r from-brand to-brand-dark py-3 text-sm font-bold text-white shadow-md shadow-brand/25 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {{ loading ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
  </div>
</template>
