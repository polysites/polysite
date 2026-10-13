<script setup lang="ts">
// Core fallback.
defineProps<{
  heading: string;
  items: { heading: string; body?: string; ctaLabel?: string; ctaHref?: string }[];
}>();
</script>

<template>
  <section class="px-4 py-12 sm:px-8">
    <div class="mx-auto max-w-5xl">
      <h2 class="mb-8 text-3xl font-bold tracking-tight text-neutral-900">{{ heading }}</h2>
      <ul class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="(item, i) in items" :key="i" class="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-6">
          <h3 class="text-lg font-bold text-neutral-900">{{ item.heading }}</h3>
          <p v-if="item.body" class="leading-relaxed text-neutral-600">{{ item.body }}</p>
          <NuxtLink v-if="item.ctaLabel && item.ctaHref" :to="item.ctaHref" class="mt-auto pt-2 text-sm font-bold text-[var(--brand-primary)] hover:underline">
            {{ item.ctaLabel }}
          </NuxtLink>
        </li>
      </ul>
    </div>
  </section>
</template>
