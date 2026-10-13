<script setup lang="ts">
// Core fallback.
defineProps<{
  photo?: { url?: string; alt?: string } | null;
  name: string;
  title?: string;
  quote: string;
  ctaLabel?: string;
  ctaHref?: string;
}>();
</script>

<template>
  <section class="bg-neutral-50 px-4 py-12 sm:px-8">
    <div class="mx-auto flex max-w-4xl flex-col items-center gap-6 sm:flex-row sm:items-start">
      <img v-if="photo?.url" :src="photo.url" :alt="photo.alt || name" width="160" height="160" class="h-40 w-40 shrink-0 rounded-full object-cover" >
      <div class="flex flex-col gap-3 text-center sm:text-left">
        <blockquote class="text-xl italic leading-relaxed text-neutral-800">{{ quote }}</blockquote>
        <p class="text-sm text-neutral-600">
          <strong class="text-neutral-900">{{ name }}</strong
          ><span v-if="title"> &middot; {{ title }}</span>
        </p>
        <NuxtLink v-if="ctaLabel && ctaHref" :to="ctaHref" class="text-sm font-bold text-[var(--brand-primary)] hover:underline">{{ ctaLabel }}</NuxtLink>
      </div>
    </div>
  </section>
</template>
