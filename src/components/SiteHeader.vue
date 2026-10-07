<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import Logo from './Logo.vue'
import { SITE } from '../site'

const open = ref(false)
const scrolled = ref(false)
const hash = ref(window.location.hash || '#/')

// The links that matter, lifted out of the footer "Explore" column so they
// live where people can actually reach them. Portals are kept separate from
// plain pages so the desktop bar can treat them as actions.
const NAV_LINKS = [
  { href: '#/', label: 'Home', sub: 'Browse data bundles', icon: 'home' },
  { href: '#/track', label: 'Track order', sub: 'Check an order', icon: 'track' },
  { href: '#/docs', label: 'API docs', sub: 'Reference for partners', icon: 'docs' },
]

const PORTALS = [
  { href: '#/admin', label: 'Admin', sub: 'Staff & operations', icon: 'admin' },
  { href: '#/partners', label: 'Partner console', sub: 'Sell data with us', icon: 'partner' },
]

/* Stroke-based glyphs (lucide-style) — injected into <svg> as trusted static markup. */
const ICON_PATHS = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  track: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>',
  docs: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  admin: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  partner: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
}

/* Per-link icon tile gradients so each mobile row reads at a glance. */
const TILE = {
  home: 'from-brand to-emerald-400',
  track: 'from-accent to-accent-dark',
  docs: 'from-sky-400 to-indigo-500',
  admin: 'from-teal-500 to-brand',
  partner: 'from-accent to-accent-dark',
}

const isActive = (href) => {
  if (href === '#/') return hash.value === '#/' || hash.value === '#/home'
  return (
    hash.value === href ||
    hash.value.startsWith(`${href}/`) ||
    hash.value.startsWith(`${href}?`)
  )
}

const close = () => {
  open.value = false
}

const onHashChange = () => {
  hash.value = window.location.hash || '#/'
  close()
}
const onKeydown = (e) => {
  if (e.key === 'Escape') close()
}
const onScroll = () => {
  scrolled.value = window.scrollY > 8
}
const onResize = () => {
  if (window.innerWidth >= 768) close()
}

watch(open, (v) => {
  document.body.style.overflow = v ? 'hidden' : ''
})

onMounted(() => {
  window.addEventListener('hashchange', onHashChange)
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize)
  onScroll()
})
onUnmounted(() => {
  document.body.style.overflow = ''
  window.removeEventListener('hashchange', onHashChange)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <header
    class="sticky top-0 z-40 border-b bg-surface/90 backdrop-blur-md transition-shadow duration-300"
    :class="scrolled ? 'border-brand/15 shadow-[0_16px_40px_-20px_rgba(11,46,32,0.35)]' : 'border-brand/10'"
  >
    <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
      <a href="#/" class="flex shrink-0 items-center" aria-label="DataPadi home">
        <Logo :size="28" :text-class="'text-lg font-heading font-bold tracking-tight sm:text-xl'" />
      </a>

      <!-- Desktop navigation -->
      <nav class="hidden items-center gap-1 md:flex md:gap-1.5">
        <a
          v-for="link in NAV_LINKS"
          :key="link.label"
          :href="link.href"
          class="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-200"
          :class="isActive(link.href) ? 'bg-brand-soft text-brand' : 'text-ink/60 hover:bg-brand-soft/70 hover:text-brand'"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" v-html="ICON_PATHS[link.icon]"></svg>
          {{ link.label }}
        </a>
      </nav>

      <div class="hidden items-center gap-2.5 md:flex">
        <span class="h-5 w-px bg-brand/10" aria-hidden="true"></span>
        <a href="#/admin" class="rounded-xl bg-brand-soft px-3.5 py-2 text-xs font-bold text-brand transition-colors hover:bg-brand/10">Admin</a>
        <a href="#/partners" class="clay-btn rounded-xl bg-gradient-to-r from-accent to-accent-dark px-3.5 py-2 text-xs font-extrabold text-white">Partner console</a>
      </div>

      <!-- Mobile toggle -->
      <button
        type="button"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-brand/10 bg-surface text-brand-dark transition-colors hover:border-brand/25 md:hidden"
        :aria-expanded="open"
        aria-label="Toggle navigation menu"
        @click="open = !open"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" v-html="open ? ICON_PATHS.close : ICON_PATHS.menu"></svg>
      </button>
    </div>
  </header>

  <!-- Mobile overlay menu -->
  <Transition name="dp-nav">
    <div v-if="open" class="fixed inset-0 z-50 flex flex-col overflow-hidden bg-brand-dark text-white md:hidden">
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,166,35,0.12),transparent_55%)]"></div>
      <div class="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-accent/20 blur-3xl"></div>
      <div class="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-brand/40 blur-3xl"></div>

      <div class="relative z-10 mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo inverse :size="26" :text-class="'text-lg font-heading font-bold tracking-tight text-white'" />
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur transition hover:rotate-90 hover:bg-white/20"
          aria-label="Close menu"
          @click="close"
        >
          <svg class="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" v-html="ICON_PATHS.close"></svg>
        </button>
      </div>

      <nav class="relative z-10 flex-1 overflow-y-auto px-4 pb-10 sm:px-6">
        <div class="mx-auto w-full max-w-md">
          <p class="dp-nav-item px-1 text-[10px] font-extrabold tracking-[0.25em] text-accent uppercase" style="animation-delay: 40ms">Menu</p>
          <div class="mt-3 space-y-2.5">
            <a
              v-for="(link, i) in NAV_LINKS"
              :key="link.label"
              :href="link.href"
              class="dp-nav-item group flex items-center justify-between rounded-2xl border px-3.5 py-3 transition-all duration-300"
              :class="isActive(link.href) ? 'border-accent/60 bg-white/15' : 'border-white/10 bg-white/[0.06] hover:border-white/25 hover:bg-white/10'"
              :style="{ animationDelay: `${120 + i * 60}ms` }"
            >
              <span class="flex items-center gap-3.5">
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg shadow-black/25" :class="TILE[link.icon]">
                  <svg class="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" v-html="ICON_PATHS[link.icon]"></svg>
                </span>
                <span>
                  <span class="block font-heading text-sm font-bold tracking-tight">{{ link.label }}</span>
                  <span class="block text-xs font-medium text-white/50">{{ link.sub }}</span>
                </span>
              </span>
              <svg class="h-4 w-4 text-white/30 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" v-html="ICON_PATHS.chevron"></svg>
            </a>
          </div>

          <p class="dp-nav-item mt-7 px-1 text-[10px] font-extrabold tracking-[0.25em] text-accent uppercase" style="animation-delay: 360ms">Portals</p>
          <div class="mt-3 space-y-2.5">
            <a
              v-for="(p, i) in PORTALS"
              :key="p.label"
              :href="p.href"
              class="dp-nav-item flex items-center gap-3.5 rounded-2xl px-3.5 py-3 transition-all duration-300"
              :class="i === 1
                ? 'clay-btn bg-gradient-to-r from-accent to-accent-dark text-white'
                : 'border border-white/15 bg-white/[0.06] text-white hover:bg-white/10'"
              :style="{ animationDelay: `${430 + i * 60}ms` }"
            >
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" :class="i === 1 ? 'bg-white/20' : 'bg-white/10'">
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" v-html="ICON_PATHS[p.icon]"></svg>
              </span>
              <span class="flex-1">
                <span class="block font-heading text-sm font-bold tracking-tight">{{ p.label }}</span>
                <span class="block text-xs font-medium" :class="i === 1 ? 'text-white/70' : 'text-white/50'">{{ p.sub }}</span>
              </span>
              <svg class="h-4 w-4 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" v-html="ICON_PATHS.chevron"></svg>
            </a>
          </div>

          <p class="dp-nav-item mt-8 px-1 text-center text-[11px] font-medium text-white/40" style="animation-delay: 620ms">
            Instant support at
            <a :href="`mailto:${SITE.supportEmail}`" class="font-semibold text-white/60 underline-offset-2 hover:text-accent hover:underline">{{ SITE.supportEmail }}</a>
          </p>
        </div>
      </nav>
    </div>
  </Transition>
</template>

<style scoped>
/* Staggered entrance for the rows inside the mobile overlay. Base state is
   hidden so the inline `animation-delay` produces the cascade. */
.dp-nav-item {
  opacity: 0;
  animation: dp-nav-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes dp-nav-in {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Overlay itself. */
.dp-nav-enter-active {
  transition:
    opacity 0.3s ease,
    transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}
.dp-nav-enter-from {
  opacity: 0;
  transform: scale(0.98) translateY(-6px);
}
.dp-nav-leave-active {
  transition: opacity 0.22s ease;
}
.dp-nav-leave-to {
  opacity: 0;
}
</style>