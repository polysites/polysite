<script setup lang="ts">
// Which theme renders is per-Site data (Sites.theme), not a build-time
// choice -- every theme repo extended in nuxt.config.ts names its layout
// file after itself (layouts/acme.vue, layouts/bakery.vue, ...) instead of
// the Nuxt convention `default.vue`, so they can all coexist in one build;
// this picks between them per-request via useSite()'s hostname resolution.
// "default" is the fallback for a Site with no theme set (layouts/default.vue,
// a neutral fallback owned by this core app, not any specific client) --
// matches Sites.theme's own defaultValue.
const site = await useSite();
const themeName = computed(() => site.value?.theme || "default");

// nuxt.config.ts can only set one build-time site name, which would put the same name in every site's page titles
// ("About | Polysite") and og:site_name. This install hosts many sites, so each request uses its own site's name.
const siteDisplayName = computed(() => site.value?.name || "");
useHead({
  titleTemplate: (title) => {
    const name = siteDisplayName.value;
    if (!name) return title ?? "";
    return title && title !== name ? `${title} | ${name}` : name;
  },
});
useSeoMeta({ ogSiteName: siteDisplayName });

// The page's language and reading direction (a site with one language is always English, left to right). <html lang dir> is
// written at the end of rendering (server/plugins/htmlLanguage.ts) because the SEO modules also write lang and would override
// it from here; they get the language through the site configuration so og:locale and the canonical address agree.
const language = useSiteLanguage();
updateSiteConfig({ currentLocale: language.code.value, defaultLocale: language.defaultCode.value });
watch(language.code, (code) => updateSiteConfig({ currentLocale: code }));
if (import.meta.server) useRequestEvent()!.context.polysiteLanguage = { code: language.code.value, dir: language.dir.value };

// BlockRenderer reads this to pick the site's theme components (see
// utils/resolveBlock.ts). Set during setup so SSR and hydration agree.
useState<string>("polysite-theme", () => "default").value = themeName.value;

// Per-site custom CSS/JS (Sites.customCss/customJs) -- injected site-wide
// regardless of which theme renders, so this lives here rather than in each
// theme's layout. Both are admin-only fields (Sites' own access control is
// admin-only write, never loosened for Content Editor/Campaign Manager).
//
// customJs genuinely executes in every visitor's browser once set --
// checked for real, not assumed: this app's nuxt-security CSP (unchanged,
// pre-existing) is `script-src 'self' https: 'unsafe-inline' 'strict-dynamic'
// 'nonce-...'`. `useHead()`'s injected <script>/<style> tags do NOT get that
// nonce attached (confirmed via DOM inspection -- no `nonce` attribute on
// either tag), so what actually permits them to run is the `'unsafe-inline'`
// already present in the header as a fallback, not nonce-gating. That
// `'unsafe-inline'` predates this feature and wasn't added for it -- but be
// clear-eyed about what it means: this field is only as safe as Payload's
// own admin-only write access on Sites. If that access control were ever
// loosened or bypassed, this becomes a genuine stored-XSS vector for every
// visitor of the affected site, not something CSP would additionally catch.
useHead({
  style: computed(() => (site.value?.customCss ? [{ innerHTML: site.value.customCss }] : [])),
  script: computed(() => (site.value?.customJs ? [{ innerHTML: site.value.customJs }] : [])),
});
</script>

<template>
  <NuxtLayout :name="themeName">
    <NuxtPage />
  </NuxtLayout>
  <SiteSlot name="app" :site="site" />
</template>
