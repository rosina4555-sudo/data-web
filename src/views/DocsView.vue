<script setup>
/**
 * The published partner API reference, at #/docs.
 *
 * Public on purpose: a partner reaches it from the home page before it has any
 * credentials, and reaches it from its dashboard while holding a session it
 * must not break — so this page carries no session of its own. The document
 * itself comes from the backend (`GET /v1/docs/partner-api`, which serves
 * PARTNER_API.md), so the reference rendered here is the file the repository
 * maintains rather than a second copy that could fall behind.
 *
 * The contents list uses scroll instead of in-page hash links: a raw `#anchor`
 * would replace the whole hash, and the router would read an unrecognised one
 * as "nobody asked for this" and drop the reader on the home page.
 */
import { ref, onMounted } from 'vue'
import { api } from '../services/api'
import { tenantIsAuthenticated } from '../services/tenantApi'
import { renderMarkdown } from '../utils/markdown'
import Logo from '../components/Logo.vue'
import LoadError from '../components/LoadError.vue'

const html = ref('')
const toc = ref([])
const revision = ref('')
const error = ref('')
const busy = ref(false)
const signedIn = ref(false)

const load = async () => {
  busy.value = true
  error.value = ''
  try {
    const body = await api.getPartnerApiReference()
    const rendered = renderMarkdown(body.data.markdown)
    html.value = rendered.html
    toc.value = rendered.toc
    revision.value = body.data.revision || ''
  } catch (e) {
    error.value = e.message || 'The reference could not be loaded.'
  } finally {
    busy.value = false
  }
}

// The back link points at the dashboard when there is one waiting and at the
// console sign-in when there is not. `tenantIsAuthenticated` returns before it
// reaches the network when no partner token is stored, so this is free for
// everybody who is only reading the docs.
const checkSession = async () => {
  signedIn.value = await tenantIsAuthenticated()
}

const jump = (id) => {
  const heading = document.getElementById(id)
  if (!heading) return
  heading.scrollIntoView({ behavior: 'smooth', block: 'start' })
  window.history.replaceState(null, '', window.location.hash)
}

onMounted(() => {
  checkSession()
  load()
})
</script>

<template>
  <div class="flex min-h-screen flex-col bg-brand-dark/[0.03] text-ink">
    <header class="sticky top-0 z-40 border-b border-brand/10 bg-surface/95 backdrop-blur-md">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16">
        <div class="flex min-w-0 items-center gap-3">
          <a href="#/" class="flex shrink-0 items-center" aria-label="DataPadi home">
            <Logo :size="24" :text-class="'text-base font-heading font-bold tracking-tight sm:text-lg'" />
          </a>
          <span class="rounded-full bg-brand/10 px-2.5 py-0.5 text-[10px] font-extrabold tracking-widest text-brand uppercase">API docs</span>
        </div>
        <a
          href="#/partners"
          class="shrink-0 rounded-lg border border-brand/25 px-3 py-1.5 text-xs font-bold text-brand transition hover:bg-brand-soft"
        >
          {{ signedIn ? 'Back to dashboard' : 'Partner console' }}
        </a>
      </div>
    </header>

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-10">
      <LoadError :error="error" :busy="busy" class="mb-6" @retry="load" />

      <!-- Contents on a phone: one disclosure above the document, because a
           fixed sidebar would eat the width the code blocks need. -->
      <details v-if="toc.length && !error" class="mb-6 rounded-xl border border-brand/10 bg-surface lg:hidden">
        <summary class="cursor-pointer select-none px-4 py-3 text-xs font-bold tracking-widest text-brand uppercase">
          Contents
        </summary>
        <ul class="border-t border-brand/10 px-4 py-2">
          <li v-for="entry in toc" :key="entry.id">
            <button
              type="button"
              class="block w-full py-1 text-left text-sm transition hover:text-brand"
              :class="[entry.level === 2 ? 'font-bold text-ink' : 'pl-3 text-ink/55']"
              @click="jump(entry.id)"
            >
              {{ entry.text }}
            </button>
          </li>
        </ul>
      </details>

      <div class="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
        <aside class="hidden lg:block">
          <nav class="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
            <p class="text-[10px] font-bold tracking-widest text-muted uppercase">Contents</p>
            <ul class="mt-2.5 space-y-1.5">
              <li v-for="entry in toc" :key="entry.id">
                <button
                  type="button"
                  class="block w-full border-l-2 border-transparent py-0.5 text-left text-[13px] leading-snug transition hover:border-brand hover:text-brand"
                  :class="[entry.level === 2 ? 'font-bold text-ink' : 'pl-3 font-medium text-ink/50']"
                  @click="jump(entry.id)"
                >
                  {{ entry.text }}
                </button>
              </li>
            </ul>
          </nav>
        </aside>

        <article v-if="html" class="min-w-0">
          <div v-if="!busy && !error" class="mb-6 flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted">
            <span class="rounded-full bg-brand/10 px-2 py-0.5 font-bold text-brand">Partner API</span>
            <span v-if="revision">Reference revision {{ revision }}</span>
          </div>
          <!-- eslint-disable-next-line vue/no-v-html — the document is escaped
               line by line by renderMarkdown before anything is assembled. -->
          <div v-html="html"></div>
        </article>

        <div
          v-else-if="busy && !error"
          class="text-xs font-semibold tracking-widest text-muted uppercase lg:col-start-2"
        >
          Loading the reference…
        </div>
      </div>
    </main>

    <footer class="mt-8 shrink-0 border-t border-brand/10 bg-surface">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-muted">
        <p class="font-medium">The reference is published from the API reference file the repository maintains.</p>
        <a href="#/" class="font-semibold text-brand transition-colors hover:text-accent-dark">Back to home</a>
      </div>
    </footer>
  </div>
</template>
