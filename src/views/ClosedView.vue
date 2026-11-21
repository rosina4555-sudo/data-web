<script setup>
import Logo from '../components/Logo.vue'
import { SITE } from '../site'
import { CLOSURE } from '../services/closure'
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <main class="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 py-8 sm:px-6 sm:py-12">
      <section class="border border-brand/15 bg-surface">
        <div class="grid md:grid-cols-[15.5rem_1fr]">
          <!-- Brand spine: gives the notice a masthead instead of a floating card. -->
          <div class="flex flex-col justify-between gap-6 bg-brand-dark px-5 py-5 text-white md:px-7 md:py-9">
            <Logo :size="26" inverse text-class="text-lg font-heading font-bold tracking-tight" />

            <div class="hidden md:block">
              <p class="text-[10px] font-bold tracking-[0.2em] text-white/45 uppercase">Store status</p>
              <p class="mt-2 font-heading text-sm leading-snug font-semibold text-white/90">
                Closed for maintenance
              </p>
              <span class="mt-4 block h-px w-9 bg-accent" aria-hidden="true"></span>
              <p class="mt-4 text-[11px] leading-5 text-white/50">{{ SITE.networksServed }}</p>
            </div>

            <p class="text-[10px] font-semibold tracking-[0.16em] text-white/40 uppercase md:hidden">
              Closed for maintenance
            </p>
          </div>

          <div class="px-6 py-8 sm:px-10 sm:py-10">
            <p class="text-[10px] font-bold tracking-[0.22em] text-brand uppercase">
              {{ CLOSURE.badge }}
            </p>

            <h1 class="mt-3 font-heading text-[1.85rem] leading-[1.12] font-bold tracking-tight text-brand-dark sm:text-[2.35rem]">
              {{ CLOSURE.title }}
            </h1>

            <p class="mt-5 max-w-prose text-sm leading-7 text-ink/75 sm:text-[15px]">
              {{ CLOSURE.body }}
            </p>

            <p class="mt-3 max-w-prose text-sm leading-7 text-ink/75 sm:text-[15px]">
              {{ CLOSURE.note }}
            </p>

            <div class="mt-8 border-t border-brand/10 pt-5">
              <a
                href="#/track"
                class="group inline-flex items-baseline gap-2 text-sm font-bold text-brand underline decoration-brand/25 underline-offset-[6px] transition hover:decoration-brand"
              >
                {{ CLOSURE.trackingLabel }}
                <span class="text-accent-dark transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
              </a>

              <p class="mt-4 text-xs leading-6 text-muted">
                Something else on your mind? Write to
                <a
                  :href="`mailto:${SITE.supportEmail}`"
                  class="font-semibold text-ink/80 underline decoration-brand/20 underline-offset-4 transition hover:text-brand hover:decoration-brand"
                >{{ SITE.supportEmail }}</a>
                and we'll pick it up as soon as we're back.
              </p>
            </div>
          </div>
        </div>
      </section>

      <p class="mt-6 text-center text-[11px] font-medium text-muted/60">
        {{ SITE.copyright }}
      </p>
    </main>
  </div>
</template>
