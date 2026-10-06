<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import HomeView from './views/HomeView.vue'
import TrackOrderView from './views/TrackOrderView.vue'
import AdminLogin from './views/AdminLogin.vue'
import AdminView from './views/AdminView.vue'
import PartnersLogin from './views/PartnersLogin.vue'
import PartnersView from './views/PartnersView.vue'
import ToastHost from './components/ToastHost.vue'
import { isAuthenticated } from './services/auth'
import { partnerIsAuthenticated } from './services/partnerApi'

const hash = ref(window.location.hash || '#/')
const authed = ref(false)
const partnerAuthed = ref(false)
const ready = ref(false)

const onHash = () => {
  hash.value = window.location.hash || '#/'
  window.scrollTo({ top: 0, behavior: 'instant' })
}

onMounted(async () => {
  window.addEventListener('hashchange', onHash)
  // Two independent sessions. The partner console keeps its own token, so
  // signing in there must not sign the main console in, and a 401 in one must
  // not bounce the other — hence a separate flag and a separate check.
  if (hash.value.startsWith('#/admin')) {
    authed.value = await isAuthenticated()
  }
  if (hash.value.startsWith('#/partners')) {
    partnerAuthed.value = await partnerIsAuthenticated()
  }
  // Re-run session check when coming back to #/admin later
  if (hash.value === '#/admin' && authed.value) authed.value = await isAuthenticated()
  if (hash.value === '#/partners' && partnerAuthed.value) partnerAuthed.value = await partnerIsAuthenticated()
  ready.value = true
})
onUnmounted(() => window.removeEventListener('hashchange', onHash))

const isHome = computed(() => hash.value === '#/' || hash.value === '#/home')
const isTrack = computed(() => hash.value.startsWith('#/track'))
const isAdminHub = computed(() => hash.value.startsWith('#/admin'))
const isLogin = computed(() => isAdminHub.value && !authed.value)
const isDashboard = computed(() => isAdminHub.value && authed.value)

// Checked before #/admin because '#/admin...' is a prefix of neither, but kept
// explicit so the ordering intent survives a future rename.
const isPartnersHub = computed(() => hash.value.startsWith('#/partners'))
const isPartnersLogin = computed(() => isPartnersHub.value && !partnerAuthed.value)
const isPartnersDashboard = computed(() => isPartnersHub.value && partnerAuthed.value)

const onAuthenticated = () => {
  authed.value = true
}
const onLogout = () => {
  authed.value = false
}
const onPartnerAuthenticated = () => {
  partnerAuthed.value = true
}
</script>

<template>
  <ToastHost />
  <template v-if="ready">
    <HomeView v-if="isHome" />
    <TrackOrderView v-else-if="isTrack" />
    <AdminLogin v-else-if="isLogin" @authenticated="onAuthenticated" />
    <AdminView v-else-if="isDashboard" @logout="onLogout" />
    <PartnersLogin v-else-if="isPartnersLogin" @authenticated="onPartnerAuthenticated" />
    <PartnersView v-else-if="isPartnersDashboard" />
  </template>
</template>