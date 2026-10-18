<script setup lang="ts">
// Core fallback. bodyHTML is computed server-side from the Lexical AST by the
// block's `afterRead` hook (apps/cms), from an authenticated editor, so it is
// rendered unescaped.
defineProps<{
  heading?: string;
  bodyHTML?: string;
}>();
</script>

<template>
  <section class="px-4 py-12 sm:px-8">
    <div class="mx-auto max-w-3xl">
      <h2 v-if="heading" class="mb-4 text-2xl font-bold tracking-tight text-neutral-900">{{ heading }}</h2>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-if="bodyHTML" class="poly-prose" v-html="bodyHTML" />
    </div>
  </section>
</template>

<style scoped>
/* Tailwind's reset strips the browser's own typography, so rich text gets a small readable one back. */
.poly-prose { line-height: 1.7; color: #404040; }
.poly-prose :deep(p) { margin: 0 0 1rem; }
.poly-prose :deep(h2), .poly-prose :deep(h3), .poly-prose :deep(h4) { margin: 1.5rem 0 0.5rem; font-weight: 700; color: #171717; line-height: 1.3; }
.poly-prose :deep(h2) { font-size: 1.5rem; }
.poly-prose :deep(h3) { font-size: 1.25rem; }
.poly-prose :deep(ul), .poly-prose :deep(ol) { margin: 0 0 1rem; padding-inline-start: 1.5rem; }
.poly-prose :deep(ul) { list-style: disc; }
.poly-prose :deep(ol) { list-style: decimal; }
.poly-prose :deep(a) { color: var(--brand-primary); text-decoration: underline; }
.poly-prose :deep(blockquote) { margin: 1rem 0; padding-inline-start: 1rem; border-inline-start: 3px solid #d4d4d4; color: #525252; font-style: italic; }
.poly-prose :deep(img) { max-width: 100%; height: auto; border-radius: 0.5rem; }
</style>
