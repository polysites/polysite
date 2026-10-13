<script setup lang="ts">
// Core fallback.
defineProps<{
  heading?: string;
  features: { title: string; description?: string }[];
}>();
</script>

<template>
  <section class="px-4 py-12 sm:px-8">
    <div class="mx-auto max-w-5xl">
      <h2 v-if="heading" class="mb-8 text-3xl font-bold tracking-tight text-neutral-900">{{ heading }}</h2>
      <ul class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="(f, i) in features" :key="i" class="flex flex-col gap-2 border-t-2 border-[var(--brand-primary)] pt-4">
          <h3 class="text-lg font-bold text-neutral-900">{{ f.title }}</h3>
          <p v-if="f.description" class="leading-relaxed text-neutral-600">{{ f.description }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>
