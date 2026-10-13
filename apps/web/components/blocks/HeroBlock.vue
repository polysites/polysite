<script setup lang="ts">
// Core fallback: neutral and readable on purpose. The designed version lives in each theme
// (see themes/polysite-theme-starter/components/starter/).
defineProps<{
  heading: string;
  subheading?: string;
  image?: { url?: string; alt?: string } | null;
  ctaLabel?: string;
  ctaHref?: string;
}>();
</script>

<template>
  <section class="border-b border-neutral-200 bg-neutral-50 px-4 py-16 sm:px-8 sm:py-24">
    <div class="mx-auto flex max-w-5xl flex-col items-start gap-6">
      <img v-if="image?.url" :src="image.url" :alt="image.alt || heading" class="h-auto max-h-96 w-full rounded-xl object-cover" >
      <h1 class="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-5xl">{{ heading }}</h1>
      <p v-if="subheading" class="max-w-2xl text-lg leading-relaxed text-neutral-600">{{ subheading }}</p>
      <NuxtLink
        v-if="ctaLabel && ctaHref"
        :to="ctaHref"
        class="rounded-full bg-[var(--brand-primary)] px-6 py-2.5 text-sm font-bold text-white hover:opacity-90"
      >
        {{ ctaLabel }}
      </NuxtLink>
    </div>
  </section>
</template>
