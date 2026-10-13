<script setup lang="ts">
// Renders whatever plugins have put in a named slot (see utils/siteExtensions.ts); nothing when none have. Extra
// props (the site, say) are handed to each component.
defineOptions({ inheritAttrs: false });
const props = defineProps<{ name: string }>();
const { $siteSlots } = useNuxtApp();
const components = computed(() => $siteSlots.list(props.name));
</script>

<template>
  <component :is="component" v-for="(component, i) in components" :key="i" v-bind="$attrs" />
</template>
