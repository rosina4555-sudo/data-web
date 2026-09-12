<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import HomeView from './views/HomeView.vue'
import TrackOrderView from './views/TrackOrderView.vue'
import AdminLogin from './views/AdminLogin.vue'
import AdminView from './views/AdminView.vue'
import ToastHost from './components/ToastHost.vue'
import { isAuthenticated } from './services/auth'

const hash = ref(window.location.hash || '#/')
const authed = ref(false)
const ready = ref(false)

const onHash = () => {
  hash.value = window.location.hash || '#/'
  window.scrollTo({ top: 0, behavior: 'instant' })
}

onMounted(async () => {
  window.addEventListener('hashchange', onHash)
  if (hash.value.startsWith('#/admin')) {
    authed.value = await isAuthenticated()
  }
  // Re-run session check when coming back to #/admin later
  if (hash.value === '#/admin' && authed.value) authed.value = await isAuthenticated()
  ready.value = true
})
onUnmounted(() => window.removeEventListener('hashchange', onHash))

const isHome = computed(() => hash.value === '#/' || hash.value === '#/home')
const isTrack = computed(() => hash.value.startsWith('#/track'))
const isAdminHub = computed(() => hash.value.startsWith('#/admin'))
const isLogin = computed(() => isAdminHub.value && !authed.value)
const isDashboard = computed(() => isAdminHub.value && authed.value)

const onAuthenticated = () => {
  authed.value = true
}
const onLogout = () => {
  authed.value = false
}
</script>

<template>
  <ToastHost />
  <template v-if="ready">
    <HomeView v-if="isHome" />
    <TrackOrderView v-else-if="isTrack" />
    <AdminLogin v-else-if="isLogin" @authenticated="onAuthenticated" />
    <AdminView v-else-if="isDashboard" @logout="onLogout" />
  </template>
</template>