<script setup>
import { ref, onMounted } from 'vue'
import { storeApi } from '../../services/storeApi'
import { toast } from '../../services/toast'

// Paystack's Ghana mobile-money provider codes. Banks need the bank's own
// Paystack code, which the seller gets from their bank statement or Paystack —
// we do not guess it, because a wrong code sends money nowhere.
const MOMO_PROVIDERS = [
  { code: 'MTN', label: 'MTN Mobile Money' },
  { code: 'VOD', label: 'Telecel Cash' },
  { code: 'ATL', label: 'AirtelTigo Money' },
]

const loading = ref(true)
const loadError = ref('')
const profile = ref({ name: '', slug: '', tagline: '', description: '', whatsapp: '', phone: '' })
const payout = ref({ payout_type: 'mobile_money', payout_bank_code: 'MTN', payout_account_number: '', payout_account_name: '' })
const savingProfile = ref(false)
const savingPayout = ref(false)
const payoutReady = ref(false)

const load = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const res = await storeApi.me()
    const me = res.data
    profile.value = {
      name: me.name || '',
      slug: me.slug || '',
      tagline: me.tagline || '',
      description: me.description || '',
      whatsapp: me.whatsapp || '',
      phone: me.phone || '',
    }
    payout.value = {
      payout_type: me.payout?.type || 'mobile_money',
      payout_bank_code: me.payout?.bank_code || 'MTN',
      payout_account_number: me.payout?.account_number || '',
      payout_account_name: me.payout?.account_name || '',
    }
    payoutReady.value = !!me.payout?.ready
  } catch (err) {
    loadError.value = err?.message || 'Could not load your shop settings.'
  } finally {
    loading.value = false
  }
}

const saveProfile = async () => {
  if (savingProfile.value) return
  savingProfile.value = true
  try {
    await storeApi.updateProfile({
      name: profile.value.name,
      slug: profile.value.slug,
      tagline: profile.value.tagline,
      description: profile.value.description,
      whatsapp: profile.value.whatsapp,
      phone: profile.value.phone,
    })
    toast('Shop details saved.', 'success')
  } catch (err) {
    toast(err?.message || 'Could not save your shop details.', 'error')
  } finally {
    savingProfile.value = false
  }
}

const savePayout = async () => {
  if (savingPayout.value) return
  savingPayout.value = true
  try {
    await storeApi.updatePayout({
      payout_type: payout.value.payout_type,
      payout_bank_code:
        payout.value.payout_type === 'mobile_money'
          ? payout.value.payout_bank_code
          : String(payout.value.payout_bank_code || '').trim(),
      payout_account_number: String(payout.value.payout_account_number || '').trim(),
      payout_account_name: String(payout.value.payout_account_name || '').trim(),
    })
    payoutReady.value = true
    toast('Payout details saved.', 'success')
  } catch (err) {
    toast(err?.message || 'Could not save your payout details.', 'error')
  } finally {
    savingPayout.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="font-heading text-lg font-bold tracking-tight text-brand-dark">Shop settings</h1>
      <p class="text-xs font-medium text-muted">What customers see, and where your money goes.</p>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand/15 border-t-brand"></div>
    </div>

    <div v-else-if="loadError" class="clay rounded-3xl bg-surface py-10 text-center">
      <p class="text-sm font-semibold text-red-600">{{ loadError }}</p>
      <button type="button" class="mt-3 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600" @click="load">Retry</button>
    </div>

    <div v-else class="grid gap-4 lg:grid-cols-2">
      <form class="clay space-y-3.5 rounded-3xl bg-surface p-5" @submit.prevent="saveProfile">
        <div>
          <h2 class="text-xs font-bold tracking-widest text-muted uppercase">Public shop</h2>
          <p class="mt-1 text-[11px] text-muted">These appear on your storefront.</p>
        </div>

        <label class="block">
          <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Shop name</span>
          <input v-model="profile.name" type="text" required maxlength="100" class="clay-well w-full rounded-2xl bg-bg px-4 py-2.5 text-sm font-medium text-brand-dark outline-none" />
        </label>

        <label class="block">
          <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Shop link</span>
          <input v-model="profile.slug" type="text" maxlength="50" class="clay-well w-full rounded-2xl bg-bg px-4 py-2.5 font-mono text-sm font-medium text-brand-dark outline-none" />
          <span class="mt-1.5 block text-[11px] text-muted">datapadi.com/#/s/<b class="text-brand">{{ profile.slug || 'your-shop' }}</b></span>
        </label>

        <label class="block">
          <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Tagline</span>
          <input v-model="profile.tagline" type="text" maxlength="160" placeholder="e.g. Cheapest data in Kumasi" class="clay-well w-full rounded-2xl bg-bg px-4 py-2.5 text-sm font-medium text-brand-dark outline-none placeholder:text-muted/40" />
        </label>

        <label class="block">
          <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">About your shop <span class="font-medium text-muted">(optional)</span></span>
          <textarea v-model="profile.description" rows="4" maxlength="2000" placeholder="Delivery hours, how to reach you, anything a customer should know." class="clay-well w-full rounded-2xl bg-bg px-4 py-2.5 text-sm font-medium text-brand-dark outline-none placeholder:text-muted/40"></textarea>
        </label>

        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block">
            <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">WhatsApp</span>
            <input v-model="profile.whatsapp" type="tel" placeholder="0245000000" class="clay-well w-full rounded-2xl bg-bg px-4 py-2.5 text-sm font-medium text-brand-dark outline-none placeholder:text-muted/40" />
          </label>
          <label class="block">
            <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Phone</span>
            <input v-model="profile.phone" type="tel" placeholder="0245000000" class="clay-well w-full rounded-2xl bg-bg px-4 py-2.5 text-sm font-medium text-brand-dark outline-none placeholder:text-muted/40" />
          </label>
        </div>

        <button type="submit" :disabled="savingProfile" class="clay-btn w-full rounded-2xl bg-gradient-to-r from-brand to-brand-dark py-2.5 text-sm font-bold text-white disabled:opacity-40">
          {{ savingProfile ? 'Saving…' : 'Save shop details' }}
        </button>
      </form>

      <form class="clay space-y-3.5 rounded-3xl bg-surface p-5" @submit.prevent="savePayout">
        <div>
          <h2 class="text-xs font-bold tracking-widest text-muted uppercase">Payout destination</h2>
          <p class="mt-1 text-[11px] text-muted">
            Where withdrawals are sent. Changing it clears the saved Paystack recipient, so the next payout uses the new account.
          </p>
        </div>

        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-xl px-3 py-2 text-xs font-bold transition"
            :class="payout.payout_type === 'mobile_money' ? 'bg-brand text-white' : 'bg-brand-soft text-brand'"
            @click="payout.payout_type = 'mobile_money'; payout.payout_bank_code = 'MTN'"
          >
            Mobile money
          </button>
          <button
            type="button"
            class="flex-1 rounded-xl px-3 py-2 text-xs font-bold transition"
            :class="payout.payout_type === 'bank' ? 'bg-brand text-white' : 'bg-brand-soft text-brand'"
            @click="payout.payout_type = 'bank'; payout.payout_bank_code = ''"
          >
            Bank account
          </button>
        </div>

        <label v-if="payout.payout_type === 'mobile_money'" class="block">
          <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Network</span>
          <select v-model="payout.payout_bank_code" class="clay-well w-full rounded-2xl bg-bg px-4 py-2.5 text-sm font-semibold text-brand-dark outline-none">
            <option v-for="p in MOMO_PROVIDERS" :key="p.code" :value="p.code">{{ p.label }}</option>
          </select>
        </label>

        <label v-else class="block">
          <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Bank code</span>
          <input v-model="payout.payout_bank_code" type="text" required placeholder="e.g. 058" class="clay-well w-full rounded-2xl bg-bg px-4 py-2.5 text-sm font-medium text-brand-dark outline-none placeholder:text-muted/40" />
          <span class="mt-1.5 block text-[11px] text-muted">The Paystack bank code for your bank. Ask your bank or check your statement.</span>
        </label>

        <label class="block">
          <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">
            {{ payout.payout_type === 'mobile_money' ? 'Mobile money number' : 'Account number' }}
          </span>
          <input v-model="payout.payout_account_number" type="tel" required placeholder="0245000000" class="clay-well w-full rounded-2xl bg-bg px-4 py-2.5 text-sm font-medium text-brand-dark outline-none placeholder:text-muted/40" />
        </label>

        <label class="block">
          <span class="mb-1.5 block text-xs font-bold text-brand-dark/70">Account name</span>
          <input v-model="payout.payout_account_name" type="text" required maxlength="120" placeholder="Exactly as it appears on the account" class="clay-well w-full rounded-2xl bg-bg px-4 py-2.5 text-sm font-medium text-brand-dark outline-none placeholder:text-muted/40" />
          <span class="mt-1.5 block text-[11px] text-muted">Paystack checks this name against the account. A mismatch can fail the transfer.</span>
        </label>

        <p v-if="payoutReady" class="rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700">
          Payout details are on file. You can request a withdrawal from the Payouts tab.
        </p>

        <button type="submit" :disabled="savingPayout" class="clay-btn w-full rounded-2xl bg-gradient-to-r from-brand to-brand-dark py-2.5 text-sm font-bold text-white disabled:opacity-40">
          {{ savingPayout ? 'Saving…' : 'Save payout details' }}
        </button>
      </form>
    </div>
  </div>
</template>
