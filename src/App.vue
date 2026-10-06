<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import HomeView from './views/HomeView.vue'
import TrackOrderView from './views/TrackOrderView.vue'
import DocsView from './views/DocsView.vue'
import AdminLogin from './views/AdminLogin.vue'
import AdminView from './views/AdminView.vue'
import PartnersLogin from './views/PartnersLogin.vue'
import PartnersView from './views/PartnersView.vue'
import TenantView from './views/TenantView.vue'
import ToastHost from './components/ToastHost.vue'
import { isAuthenticated } from './services/auth'
import { partnerIsAuthenticated } from './services/partnerApi'
import { tenantIsAuthenticated } from './services/tenantApi'

// There is one partner-console URL. Everything people half-remember — the
// missing "s", the separate dashboard route this used to have, plain
// "#/dashboard" — lands on it instead of falling through to the home page,
// which reads as "that console is gone" rather than "you typed it slightly
// wrong".
const ALIASES = [
  ['#/partner', '#/partners'],
  ['#/tenant', '#/partners'],
  ['#/dashboard', '#/partners'],
]

const readHash = () => {
  const raw = window.location.hash || '#/'
  const hit = ALIASES.find(([from]) => raw === from || raw.startsWith(`${from}/`))
  if (hit) {
    window.location.hash = hit[1]
    return hit[1]
  }
  return raw
}

const hash = ref(readHash())
const authed = ref(false)
const partnerAuthed = ref(false)
const tenantAuthed = ref(false)
const ready = ref(false)

// The admin console and the partner console keep separate tokens, and the
// partner's own account keeps a third — so signing in on one must not sign in
// another, and a 401 in one must not bounce the other two.
//
// Both kinds of partner-console session sit behind the same hash, so they are
// checked in order rather than in parallel: whoever holds a staff session gets
// the staff console (one request, and no tenant check at all), and only a
// visitor without one is asked whether they are a partner. The second check is
// free when there is no tenant token — `tenantIsAuthenticated` returns before
// it reaches the network.
//
// Only the hub that is being entered is checked, and only when it has not been
// checked already: the server round trip belongs at the door, not on every
// hash change.
const syncSession = async () => {
  if (hash.value.startsWith('#/admin') && !authed.value) {
    authed.value = await isAuthenticated()
  }
  if (hash.value.startsWith('#/partners') && !partnerAuthed.value && !tenantAuthed.value) {
    partnerAuthed.value = await partnerIsAuthenticated()
    if (!partnerAuthed.value) {
      tenantAuthed.value = await tenantIsAuthenticated()
    }
  }
}

const onHash = async () => {
  hash.value = readHash()
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
const isDocs = computed(() => hash.value.startsWith('#/docs'))
const isAdminHub = computed(() => hash.value.startsWith('#/admin'))
const isLogin = computed(() => isAdminHub.value && !authed.value)
const isDashboard = computed(() => isAdminHub.value && authed.value)

// Checked before #/admin because '#/admin...' is a prefix of neither, but kept
// explicit so the ordering intent survives a future rename.
const isPartnersHub = computed(() => hash.value.startsWith('#/partners'))

// One door, two destinations behind it. The credentials decide which: a staff
// session renders the operator console, a partner's own session renders their
// dashboard, and with neither the shared sign-in form is what shows.
const isPartnersLogin = computed(
  () => isPartnersHub.value && !partnerAuthed.value && !tenantAuthed.value,
)
const isPartnersDashboard = computed(() => isPartnersHub.value && partnerAuthed.value)
const isTenantDashboard = computed(
  () => isPartnersHub.value && !partnerAuthed.value && tenantAuthed.value,
)

// A hash nobody handles rendered a blank page, which reads as "broken". The
// home page is the default destination for anything unrecognised.
const knownHash = computed(
  () =>
    isHome.value ||
    isTrack.value ||
    isDocs.value ||
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
const onTenantAuthenticated = () => {
  tenantAuthed.value = true
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
    <DocsView v-else-if="isDocs" />
    <AdminLogin v-else-if="isLogin" @authenticated="onAuthenticated" />
    <AdminView v-else-if="isDashboard" @logout="onLogout" />
    <PartnersLogin
      v-else-if="isPartnersLogin"
      @authenticated="onPartnerAuthenticated"
      @tenant-authenticated="onTenantAuthenticated"
    />
    <PartnersView v-else-if="isPartnersDashboard" />
    <TenantView v-else-if="isTenantDashboard" />
  </template>
</template>