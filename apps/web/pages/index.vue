<script setup lang="ts">
// Homepage, rendered the exact same way as every other page
// ([...slug].vue) -- Payload `content` blocks via BlockRenderer, not a
// bespoke hardcoded template. This file only exists separately because
// Nuxt's [...slug].vue catch-all doesn't match the bare root path; the
// rendering logic itself is deliberately kept identical, not customized.
//
// Lives in the core app, not a theme layer, because it's genuinely
// theme-agnostic (unlike layouts/*.vue, which differ structurally per
// theme) -- two themes both shipping their own pages/index.vue would
// collide when apps/web extends multiple theme repos at once, since routes
// are resolved by file path, not selected by name.
import { useLivePreview } from "@payloadcms/live-preview-vue";
import type { PayloadPage } from "../types/payload";

const config = useRuntimeConfig();

const page = await usePayloadPage("/");

const { data: livePage } = useLivePreview<PayloadPage>({
  initialData: page.value ?? {},
  serverURL: config.public.cmsServerUrl,
  depth: 1,
});

usePageSeoMeta(livePage, "Home");
</script>

<template>
  <main>
    <BlockRenderer v-if="livePage?.content?.length" :blocks="livePage?.content" />
  </main>
</template>
