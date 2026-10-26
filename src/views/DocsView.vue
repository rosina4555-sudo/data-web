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
 * Navigation is done by scrolling rather than in-page hash links: a raw
 * `#anchor` would replace the whole hash, and the router would read an
 * unrecognised one as "nobody asked for this" and drop the reader on the home
 * page. The article's delegated click handler therefore intercepts every
 * `a[href^="#"]` the document renders — both the table of contents and the
 * section anchors — and scrolls instead.
 */
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { api } from '../services/api'
import { renderMarkdown } from '../utils/markdown'
import SiteHeader from '../components/SiteHeader.vue'
import LoadError from '../components/LoadError.vue'
import { SITE } from '../site'

const html = ref('')
const toc = ref([])
const revision = ref('')
const error = ref('')
const busy = ref(false)
const activeId = ref('')

let articleEl = null
let headings = []
let spyFrame = 0
let copyTimer = 0

const load = async () => {
  busy.value = true
  error.value = ''
  activeId.value = ''
  try {
    const body = await api.getPartnerApiReference()
    const rendered = renderMarkdown(body.data.markdown)
    // The view carries the page title; the document's own h1 would repeat it.
    html.value = rendered.html.replace(/^<h1[\s\S]*?<\/h1>\n?/, '')
    toc.value = rendered.toc
    revision.value = body.data.revision || ''
    await nextTick()
    collectHeadings()
  } catch (e) {
    error.value = e.message || 'The reference could not be loaded.'
  } finally {
    busy.value = false
  }
}

const jump = (id) => {
  const heading = document.getElementById(id)
  if (!heading) return
  activeId.value = id
  heading.scrollIntoView({ behavior: 'smooth', block: 'start' })
  window.history.replaceState(null, '', window.location.hash)
}

/**
 * Read the viewport once and mark the heading the reader is in. Top offset
 * clears the sticky header, so the section under it counts as current.
 */
const runSpy = () => {
  spyFrame = 0
  if (!headings.length) return
  let current = headings[0]
  for (const heading of headings) {
    if (heading.getBoundingClientRect().top > 110) break
    current = heading
  }
  activeId.value = current.id
}

const scheduleSpy = () => {
  if (spyFrame) return
  spyFrame = requestAnimationFrame(runSpy)
}

const collectHeadings = () => {
  articleEl = document.querySelector('#dp-article')
  if (!articleEl) return
  headings = Array.from(articleEl.querySelectorAll('h2[id], h3[id], .dp-endpoint[id]'))
  scheduleSpy()
}

/** Copy the code block around the clicked button, with a short confirmation. */
const copyBlock = (button) => {
  const block = button.closest('.dp-code')
  const code = block && block.querySelector('pre code')
  if (!code) return
  const finish = () => {
    button.textContent = 'Copied'
    window.clearTimeout(copyTimer)
    copyTimer = window.setTimeout(() => {
      button.textContent = 'Copy'
    }, 1600)
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code.textContent).then(finish, finish)
    return
  }
  finish()
}

const onArticleClick = (event) => {
  const copyButton = event.target.closest('button[data-copy]')
  if (copyButton) {
    event.preventDefault()
    copyBlock(copyButton)
    return
  }
  const anchor = event.target.closest('a[href^="#"]')
  if (!anchor) return
  event.preventDefault()
  jump(anchor.getAttribute('href').slice(1))
}

onMounted(() => {
  window.addEventListener('scroll', scheduleSpy, { passive: true })
  load()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', scheduleSpy)
  if (spyFrame) cancelAnimationFrame(spyFrame)
  window.clearTimeout(copyTimer)
})
</script>

<template>
  <div class="flex min-h-screen flex-col bg-brand-dark/[0.03] text-ink">
    <SiteHeader />

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-10">
      <LoadError :error="error" :busy="busy" class="mb-6" @retry="load" />

      <!-- Reference header: the page's own title, so the document's leading
           h1 is dropped from the rendered markdown. -->
      <header v-if="!error" class="mb-8 border-b border-brand/10 pb-7">
        <p class="text-[11px] font-bold tracking-wider text-muted uppercase">
          Developers <span class="mx-1.5 text-brand/40">/</span> API Reference
        </p>
        <div class="mt-2.5 flex flex-wrap items-center gap-3">
          <h1 class="font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Partner API
          </h1>
          <span class="rounded-md border border-brand/20 bg-brand-soft px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider text-brand">
            v1
          </span>
          <span
            v-if="revision"
            class="rounded-md bg-surface px-2 py-0.5 text-[11px] font-medium text-muted shadow-[inset_0_0_0_1px_rgba(11,46,32,0.08)]"
          >rev {{ revision }}</span>
        </div>
        <p class="mt-3 max-w-2xl text-sm leading-7 text-ink/70">
          The B2B surface for reselling our bundles through your own storefront.
          Everything lives under <code class="rounded bg-brand/10 px-1.5 py-0.5 font-mono text-[0.85em] font-semibold text-brand">/v1/tenant</code>
          and is authenticated with an API key.
        </p>
        <div class="mt-5 flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center gap-1.5 rounded-lg border border-brand/10 bg-surface px-2.5 py-1.5 text-[11px] text-muted">
            <span class="font-bold tracking-wider text-ink/50 uppercase">Base</span>
            <code class="font-mono font-semibold text-ink">/v1/tenant</code>
          </span>
          <span class="inline-flex items-center gap-1.5 rounded-lg border border-brand/10 bg-surface px-2.5 py-1.5 text-[11px] text-muted">
            <span class="font-bold tracking-wider text-ink/50 uppercase">Auth</span>
            <code class="font-mono font-semibold text-ink">Bearer &lt;api-key&gt;</code>
          </span>
          <span class="inline-flex items-center gap-1.5 rounded-lg border border-brand/10 bg-surface px-2.5 py-1.5 text-[11px] text-muted">
            <span class="font-bold tracking-wider text-ink/50 uppercase">Errors</span>
            <code class="font-mono font-semibold text-ink">application/problem+json</code>
          </span>
          <a
            href="#/partners"
            class="clay-btn-gold ml-auto inline-flex items-center rounded-xl bg-gradient-to-r from-accent to-accent-dark px-4 py-2 text-xs font-bold text-white"
          >Get API key</a>
        </div>
      </header>

      <!-- Contents on a phone: one disclosure above the document, because a
           fixed sidebar would eat the width the code blocks need. -->
      <details v-if="toc.length && !error" class="mb-6 rounded-xl border border-brand/10 bg-surface lg:hidden">
        <summary class="cursor-pointer select-none px-4 py-3 text-xs font-bold tracking-wider text-brand uppercase">
          Contents
        </summary>
        <ul class="border-t border-brand/10 px-4 py-2">
          <li v-for="entry in toc" :key="entry.id">
            <button
              type="button"
              class="block w-full py-1 text-left text-sm transition hover:text-brand"
              :class="[
                entry.level === 2 ? 'font-bold text-ink' : 'pl-3 text-ink/55',
                activeId === entry.id && 'text-brand',
              ]"
              @click="jump(entry.id)"
            >
              {{ entry.text }}
            </button>
          </li>
        </ul>
      </details>

      <div class="lg:grid lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-10">
        <aside class="hidden lg:block">
          <nav class="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
            <p class="text-[10px] font-bold tracking-wider text-muted uppercase">Contents</p>
            <ul class="mt-2.5 space-y-1">
              <li v-for="entry in toc" :key="entry.id">
                <button
                  type="button"
                  class="block w-full rounded-r-lg border-l-2 py-1 pr-2 text-left text-[13px] leading-snug transition"
                  :class="[
                    entry.level === 2
                      ? 'font-medium text-ink/70'
                      : 'pl-3 text-[12.5px] text-ink/45',
                    activeId === entry.id
                      ? 'border-brand bg-brand-soft/70 font-semibold text-brand'
                      : 'border-transparent hover:border-brand/40 hover:text-brand',
                  ]"
                  @click="jump(entry.id)"
                >
                  {{ entry.text }}
                </button>
              </li>
            </ul>
          </nav>
        </aside>

        <!-- eslint-disable-next-line vue/no-v-html — the document is escaped
             line by line by renderMarkdown before anything is assembled. The
             handler below covers the anchors and copy buttons it renders. -->
        <article
          id="dp-article"
          v-if="html"
          class="min-w-0"
          @click="onArticleClick"
        >
          <div v-html="html"></div>
        </article>

        <div
          v-else-if="busy && !error"
          class="text-xs font-semibold tracking-wider text-muted uppercase lg:col-start-2"
        >
          Loading the reference…
        </div>
      </div>
    </main>

    <footer class="mt-8 shrink-0 border-t border-brand/10 bg-surface">
      <div class="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p class="font-medium">The reference is published from the API reference file the repository maintains.</p>
          <a href="#/" class="font-semibold text-brand transition-colors hover:text-accent-dark">Back to home</a>
        </div>
        <p class="text-[11px] font-medium text-muted/70">
          Designed &amp; built by
          <a
            :href="SITE.builtBy.url"
            target="_blank"
            rel="noopener noreferrer"
            class="font-bold text-brand transition-colors hover:text-accent-dark"
          >{{ SITE.builtBy.name }} ↗</a>
        </p>
      </div>
    </footer>
  </div>
</template>
