<script setup lang="ts">
// Core fallback.
const props = defineProps<{
  heading: string;
  amounts: { amount: number }[];
  donateHref?: string;
}>();

const base = () => props.donateHref || "/donate";
</script>

<template>
  <section class="bg-neutral-50 px-4 py-12 sm:px-8">
    <div class="mx-auto max-w-3xl text-center">
      <h2 class="mb-6 text-3xl font-bold tracking-tight text-neutral-900">{{ heading }}</h2>
      <p class="flex flex-wrap justify-center gap-3">
        <a
          v-for="(a, i) in amounts"
          :key="i"
          :href="`${base()}?ask=${a.amount}`"
          class="rounded-full border border-neutral-300 bg-white px-6 py-2.5 text-sm font-bold text-neutral-900 hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
        >${{ a.amount }}</a>
        <a :href="base()" class="rounded-full bg-[var(--brand-primary)] px-6 py-2.5 text-sm font-bold text-white hover:opacity-90">Other</a>
      </p>
    </div>
  </section>
</template>
