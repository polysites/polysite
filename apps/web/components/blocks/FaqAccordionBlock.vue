<script setup lang="ts">
// Core fallback.
defineProps<{
  heading?: string;
  items: { question: string; answer: string }[];
}>();
</script>

<template>
  <section class="px-4 py-12 sm:px-8">
    <div class="mx-auto max-w-3xl">
      <h2 v-if="heading" class="mb-6 text-3xl font-bold tracking-tight text-neutral-900">{{ heading }}</h2>
      <details v-for="(item, i) in items" :key="i" class="group border-b border-neutral-200 py-4">
        <summary class="cursor-pointer list-none font-bold text-neutral-900 marker:content-none">
          {{ item.question }}
        </summary>
        <p class="mt-3 leading-relaxed text-neutral-600">{{ item.answer }}</p>
      </details>
    </div>
  </section>
</template>
