<script setup>
import { ref } from 'vue'
import { login } from '../services/auth'
import { toast } from '../services/toast'
import Logo from '../components/Logo.vue'

const emit = defineEmits(['authenticated'])

const email = ref('')
const password = ref('')
const loading = ref(false)
const showPassword = ref(false)

const submit = async () => {
  if (loading.value) return
  loading.value = true
  const res = await login(email.value, password.value)
  loading.value = false
  if (res.ok) {
    toast('Welcome back!', 'success')
    emit('authenticated')
    window.location.hash = '#/admin'
  } else {
    toast(res.error || 'Login failed', 'error')
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center px-4 py-10 text-ink">
    <div class="mb-6 flex flex-col items-center gap-2">
      <Logo :size="40" :text-class="'text-2xl font-heading font-bold tracking-tight'" />
      <p class="text-xs font-semibold tracking-widest text-muted uppercase">Admin console</p>
    </div>

    <form class="clay w-full max-w-sm rounded-3xl bg-surface p-6 sm:p-8" @submit.prevent="submit">
      <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Sign in</h1>
      <p class="mt-1 text-xs text-muted">Access the DataPadi control panel.</p>

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
          <div class="relative">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              required
              placeholder="••••••••"
              class="clay-well w-full rounded-2xl bg-bg px-4 py-3 pr-12 text-sm font-medium text-brand-dark outline-none transition placeholder:text-muted/40 focus:bg-surface"
            />
            <button
              type="button"
              aria-label="Toggle password visibility"
              class="absolute top-1/2 right-3 -translate-y-1/2 text-xs font-bold text-muted/60 transition hover:text-brand"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? 'Hide' : 'Show' }}
            </button>
          </div>
        </label>
      </div>

      <button
        type="submit"
        :disabled="loading"
        class="clay-btn mt-6 w-full rounded-2xl bg-gradient-to-r from-brand to-brand-dark py-3 text-sm font-extrabold tracking-wide text-white transition disabled:opacity-50"
      >
        {{ loading ? 'Signing in…' : 'Sign in →' }}
      </button>

      <div class="mt-5 flex items-center justify-between text-[11px] font-semibold">
        <a href="#/" class="flex items-center gap-1 text-muted/70 transition hover:text-brand">
          <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back to site
        </a>
      </div>
    </form>
  </div>
</template>