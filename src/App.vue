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

// Two independent sessions. The partner console keeps its own token, so
// signing in there must not sign the main console in, and a 401 in one must
// not bounce the other — hence two flags and two checks.
//
// Only the hub that is being entered is checked, and only when it has not been
// checked already: the server round trip belongs at the door, not on every
// hash change.
const syncSession = async () => {
  if (hash.value.startsWith('#/admin') && !authed.value) {
    authed.value = await isAuthenticated()
  }
  if (hash.value.startsWith('#/partners') && !partnerAuthed.value) {
    partnerAuthed.value = await partnerIsAuthenticated()
  }
}

const onHash = async () => {
  hash.value = window.location.hash || '#/'
  window.scrollTo({ top: 0, behavior: 'instant' })
  // The session was previously only checked for whatever hash the page was
  // opened on, so walking from the home page to #/admin showed the login form
  // to someone already signed in.
  await syncSession()
}

onMounted(async () => {
  window.addEventListener('hashchange', onHash)
  await syncSession()
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

// A hash nobody handles rendered a blank page, which reads as "broken". The
// home page is the default destination for anything unrecognised.
const knownHash = computed(
  () =>
    isHome.value ||
    isTrack.value ||
    isAdminHub.value ||
    isPartnersHub.value,
)

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

  <!-- Session checks are a round trip; an empty frame while they run looks
       like a failed load. -->
  <div
    v-if="!ready"
    class="flex min-h-screen items-center justify-center text-xs font-semibold tracking-widest text-muted uppercase"
  >
    Loading…
  </div>

  <template v-else>
    <HomeView v-if="isHome || !knownHash" />
    <TrackOrderView v-else-if="isTrack" />
    <AdminLogin v-else-if="isLogin" @authenticated="onAuthenticated" />
    <AdminView v-else-if="isDashboard" @logout="onLogout" />
    <PartnersLogin v-else-if="isPartnersLogin" @authenticated="onPartnerAuthenticated" />
    <PartnersView v-else-if="isPartnersDashboard" />
  </template>
</template>