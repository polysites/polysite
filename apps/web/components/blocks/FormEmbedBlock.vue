<script setup lang="ts">
// Core fallback: neutral styling from .poly-form-defaults (assets/css/main.css). A theme draws its own (see the
// starter theme); the behaviour is shared through useFormIntake.
const props = defineProps<{
  heading?: string;
  form?: number | string | { id?: number | string } | null;
}>();

const intake = useFormIntake(() => props.form);
</script>

<template>
  <section class="px-4 py-12 sm:px-8">
    <div class="poly-form-defaults mx-auto max-w-2xl">
      <h2 v-if="heading" class="mb-6 text-3xl font-bold tracking-tight text-neutral-900">{{ heading }}</h2>
      <PolysiteFormFields v-if="formIdOf(form)" :intake="intake" />
    </div>
  </section>
</template>
