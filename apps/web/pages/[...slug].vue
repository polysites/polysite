<script setup lang="ts">
// Renders everything that isn't the homepage (pages/index.vue). Two kinds of address live here:
//
//  - addresses a content-type plugin owns (news, for the posts plugin): each plugin's web part registers a route,
//    and the first that owns the address and has something to show draws it with its own component;
//  - every other address, looked up as a page in Payload's `pages` collection by slug (and, failing that, as a
//    redirect).
//
// A plugin route that finds nothing falls through to the page lookup, so a redirect an editor made from an old
// plugin address still works. Cached per the isr route rule in nuxt.config.ts and invalidated by /api/revalidate
// when something is published.
import { useLivePreview } from "@payloadcms/live-preview-vue";
import type { PayloadPage } from "../types/payload";
import { resolveContent } from "../utils/contentRoutes";
import { splitLanguage } from "../utils/language";

const route = useRoute();
const config = useRuntimeConfig();
const nuxtApp = useNuxtApp();

const joined = Array.isArray(route.params.slug)
  ? route.params.slug.join("/")
  : (route.params.slug ?? "");

const site = await useSite();
// A language prefix (/fr/about) is not part of the page's address; "/fr" on its own is that language's home page.
const slug = splitLanguage(joined, useLanguageSetup().value).rest;
const isHome = slug === "";
const content = isHome ? null : await resolveContent(nuxtApp.$contentRoutes.all(), slug, { nuxtApp, site: site.value });
const contentComponent = content ? resolveComponent(content.component) : null;

// Not an address a plugin owns, or nothing there: an ordinary page (which also handles redirects and the 404).
const page = content ? null : await usePayloadPage(isHome ? "/" : slug);

// Outside Payload's admin iframe this never receives a postMessage, so `data` just stays at `initialData` (the
// normal SSR-fetched page) forever -- safe to always include, it only "activates" inside Live Preview. Only the
// page branch calls it: the live-preview package keeps ONE cache of the last merged data for the whole page, so
// a plugin's own component makes its own single call, and only one of the two is ever on screen.
const livePage = page
  ? useLivePreview<PayloadPage>({ initialData: page.value ?? {}, serverURL: config.public.cmsServerUrl, depth: 1 }).data
  : ref<PayloadPage | undefined>();

if (page) usePageSeoMeta(livePage, isHome ? "Home" : slug);
</script>

<template>
  <main v-if="content && contentComponent">
    <component :is="contentComponent" v-bind="content.props" />
  </main>
  <main v-else>
    <h1>{{ livePage?.title }}</h1>
    <BlockRenderer v-if="livePage?.content?.length" :blocks="livePage?.content" />
  </main>
</template>
