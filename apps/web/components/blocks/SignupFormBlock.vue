<script setup lang="ts">
// Core fallback: neutral styling from .poly-form-defaults (assets/css/main.css). A theme draws its own (see the
// starter theme); the behaviour is shared through useFormIntake.
const props = defineProps<{
  heading: string;
  subheading?: string;
  ctaLabel?: string;
  form?: number | string | { id?: number | string } | null;
}>();

const intake = useFormIntake(() => props.form);
</script>

<template>
  <section class="bg-neutral-50 px-4 py-12 sm:px-8">
    <div class="poly-form-defaults mx-auto max-w-xl">
      <h2 class="mb-2 text-3xl font-bold tracking-tight text-neutral-900">{{ heading }}</h2>
      <p v-if="subheading" class="mb-6 leading-relaxed text-neutral-600">{{ subheading }}</p>
      <PolysiteFormFields v-if="formIdOf(form)" :intake="intake" :submit-label="ctaLabel" />
    </div>
  </section>
</template>
