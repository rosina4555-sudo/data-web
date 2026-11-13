<script setup>
/**
 * Store owner front door: sign in, or open a shop.
 *
 * Registration is the first sign-in — the API returns a session with the new
 * store, so a seller never has to type the password twice. The shop link is
 * the only thing here that is not obvious, so it is shown as the public
 * address it will become rather than as a "slug" field.
 */
import { ref, computed } from 'vue'
import { storeLogin, storeRegister } from '../services/storeApi'
import { toast } from '../services/toast'
import Logo from '../components/Logo.vue'

const emit = defineEmits(['authenticated'])

const mode = ref('signin') // 'signin' | 'signup'
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const name = ref('')
const phone = ref('')
const slug = ref('')
const loading = ref(false)
const error = ref('')

const notice = ref(sessionStorage.getItem('dp_login_notice') || '')
sessionStorage.removeItem('dp_login_notice')

const isSignup = computed(() => mode.value === 'signup')

// A shop name is a URL people will type, so the field shows the address, not
// the database column. The server still validates and reserves the slug.
const slugPreview = computed(() =>
  slug.value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50),
)

const switchMode = () => {
  if (loading.value) return
  error.value = ''
  mode.value = mode.value === 'signin' ? 'signup' : 'signin'
}

const submit = async () => {
  if (loading.value) return
  error.value = ''

  if (isSignup.value) {
    if (confirmPassword.value !== password.value) {
      error.value = 'Passwords do not match.'
      return
    }

    loading.value = true
    try {
      await storeRegister({
        name: name.value.trim(),
        email: email.value.trim().toLowerCase(),
        phone: phone.value.trim() || null,
        password: password.value,
        slug: slugPreview.value || null,
      })
      toast('Shop created — welcome aboard', 'success')
      emit('authenticated')
    } catch (err) {
      error.value = err?.message || 'Could not create your shop.'
    } finally {
      loading.value = false
    }
    return
  }

  loading.value = true
  try {
    await storeLogin(email.value, password.value)
    toast('Signed in to your shop', 'success')
    emit('authenticated')
  } catch (err) {
    error.value = err?.message || 'Sign in failed.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center px-4 py-10 text-ink">
    <div class="mb-6 flex flex-col items-center gap-2">
      <Logo :size="40" :text-class="'text-2xl font-heading font-bold tracking-tight'" />
      <p class="text-xs font-semibold tracking-widest text-muted uppercase">Seller console</p>
    </div>

    <form class="clay w-full max-w-sm rounded-3xl bg-surface p-6 sm:p-8" @submit.prevent="submit">
      <p v-if="notice" class="mb-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-700">
        {{ notice }}
      </p>
      <p v-if="error" class="mb-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-600">
        {{ error }}
      </p>

      <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">
        {{ isSignup ? 'Open your shop' : 'Sign in to your shop' }}
      </h1>
      <p class="mt-1 text-xs leading-relaxed text-muted">
        <template v-if="isSignup">
          Set your own prices, share one link, and withdraw what you earn.
        </template>
        <template v-else>
          Your shop, prices, orders and payouts — all in one place.
        </template>
      </p>

      <div class="mt-5 space-y-4">
        <label v-if="isSignup" class="block">
          <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Shop name</span>
          <input
            v-model="name"
            type="text"
            autocomplete="organization"
            required
            maxlength="100"
            placeholder="e.g. Ama Data Hub"
            class="clay-well w-full rounded-2xl bg-bg px-4 py-3 text-sm font-medium text-brand-dark outline-none transition placeholder:text-muted/40 focus:bg-surface"
          />
        </label>

        <label class="block">
          <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Email</span>
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            required
            placeholder="you@example.com"
            class="clay-well w-full rounded-2xl bg-bg px-4 py-3 text-sm font-medium text-brand-dark outline-none transition placeholder:text-muted/40 focus:bg-surface"
          />
        </label>

        <label v-if="isSignup" class="block">
          <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">
            Phone <span class="font-medium text-muted">(optional)</span>
          </span>
          <input
            v-model="phone"
            type="tel"
            autocomplete="tel"
            placeholder="0245000000"
            class="clay-well w-full rounded-2xl bg-bg px-4 py-3 text-sm font-medium text-brand-dark outline-none transition placeholder:text-muted/40 focus:bg-surface"
          />
        </label>

        <label class="block">
          <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Password</span>
          <input
            v-model="password"
            type="password"
            :autocomplete="isSignup ? 'new-password' : 'current-password'"
            required
            :minlength="isSignup ? 8 : undefined"
            placeholder="At least 8 characters"
            class="clay-well w-full rounded-2xl bg-bg px-4 py-3 text-sm font-medium text-brand-dark outline-none transition placeholder:text-muted/40 focus:bg-surface"
          />
        </label>

        <label v-if="isSignup" class="block">
          <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Confirm password</span>
          <input
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            required
            placeholder="Type it again"
            class="clay-well w-full rounded-2xl bg-bg px-4 py-3 text-sm font-medium text-brand-dark outline-none transition placeholder:text-muted/40 focus:bg-surface"
          />
        </label>

        <label v-if="isSignup" class="block">
          <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">
            Shop link <span class="font-medium text-muted">(optional)</span>
          </span>
          <input
            v-model="slug"
            type="text"
            maxlength="50"
            placeholder="ama-data"
            class="clay-well w-full rounded-2xl bg-bg px-4 py-3 font-mono text-sm font-medium text-brand-dark outline-none transition placeholder:text-muted/40 focus:bg-surface"
          />
          <span class="mt-1.5 block text-[11px] text-muted">
            datapadi.com/#/s/<b class="text-brand">{{ slugPreview || 'your-shop' }}</b>
            — leave blank and we will make one for you.
          </span>
        </label>
      </div>

      <button
        type="submit"
        :disabled="loading"
        class="clay-btn-gold mt-5 w-full rounded-2xl bg-gradient-to-r from-accent to-accent-dark py-3.5 text-sm font-bold tracking-wide text-white transition focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
      >
        {{ loading ? 'Please wait…' : isSignup ? 'Create my shop' : 'Sign in' }}
      </button>

      <p class="mt-4 text-center text-xs text-muted">
        {{ isSignup ? 'Already selling?' : 'Want to sell data?' }}
        <button type="button" class="font-bold text-brand hover:underline" @click="switchMode">
          {{ isSignup ? 'Sign in' : 'Open a shop' }}
        </button>
      </p>
    </form>

    <a href="#/" class="mt-6 text-xs font-semibold text-muted hover:text-brand">← Back to DataPadi</a>
  </div>
</template>
