<script setup lang="ts">
// The app's own error page, shown for a missing page (404) and for server errors. It renders outside any layout, so
// it can't depend on a theme or on the site having loaded (the error may be that it couldn't). Uses the Polysite
// mark and colours (docs/BRAND.md), with its one typeface (Lora, public/fonts) served from this site and no other network
// requests, and follows the visitor's light/dark preference. The words follow the visitor's language, read from the address (so /fr/nothing is a French 404 on a
// site that offers French); if the site's language setup never loaded, it shows English.
const props = defineProps<{ error: { statusCode?: number } }>();

const nuxtApp = useNuxtApp();
const language = useSiteLanguage();
// A page that fails while the server renders it is replaced by this page in a fresh app, which hasn't loaded the site, so the
// languages it offers are asked for here, on the server (the browser gets the answer in the page, so asking again there could only
// lose it). Never allowed to hold up or break the error page: a site that can't be reached, or is slow, shows English.
const event = import.meta.server ? useRequestEvent() : undefined;
if (import.meta.server) {
  await Promise.race([useSite().catch(() => null), new Promise((resolve) => setTimeout(resolve, 3000))]);
  if (event) event.context.polysiteLanguage = { code: language.code.value, dir: language.dir.value };
}
const t = (key: string, fallback: string) => nuxtApp.$strings?.translate(language.code.value, key, fallback) ?? fallback;
const copy = computed(() => errorCopy(props.error?.statusCode, t));
const code = computed(() => props.error?.statusCode ?? 500);
const home = computed(() => language.localePath("/"));

updateSiteConfig({ currentLocale: language.code.value, defaultLocale: language.defaultCode.value });
useHead({
  title: () => copy.value.title,
  htmlAttrs: { lang: () => language.code.value, dir: () => language.dir.value },
});

const goHome = () => clearError({ redirect: home.value });
const canGoBack = ref(false);
onMounted(() => {
  canGoBack.value = window.history.length > 1;
});
</script>

<template>
  <main class="poly-error" :lang="language.code.value" :dir="language.dir.value">
    <div class="poly-error-card">
      <svg class="poly-error-mark" viewBox="0 0 100 100" role="img" aria-label="Polysite">
        <polygon points="16,12 34,12 34,88 16,88" fill="currentColor" />
        <polygon points="62,8 88,34 62,60 36,34" fill="var(--poly-accent)" />
        <polygon points="62,64 76,78 62,92 48,78" fill="var(--poly-accent)" />
      </svg>

      <p class="poly-error-code" aria-hidden="true">{{ code }}</p>
      <h1 class="poly-error-title">{{ copy.heading }}</h1>
      <p class="poly-error-detail">{{ copy.detail }}</p>

      <div class="poly-error-actions">
        <a :href="home" class="poly-error-button poly-error-button--primary" @click.prevent="goHome">{{ copy.home }}</a>
        <button v-if="canGoBack" type="button" class="poly-error-button" @click="$router.back()">{{ copy.back }}</button>
      </div>
    </div>

    <p class="poly-error-footer">Polysite</p>
  </main>
</template>

<style scoped>
/* Lora, weight 600, Latin subset: self-hosted (public/fonts, SIL Open Font License, licence beside the file) so the page asks no other site for a font. */
@font-face {
  font-family: "Lora";
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url("/fonts/lora-latin-600-normal.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

.poly-error {
  --poly-ink: #16213e;
  --poly-ink-muted: #4b5565;
  --poly-caption: #596477;
  --poly-on-accent: #ffffff;
  --poly-accent: #3e5ba6;
  --poly-accent-tint: #e8ecf6;
  --poly-surface: #ffffff;
  --poly-surface-raised: #f5f6f8;
  --poly-border: #e2e5ea;

  display: flex;
  min-height: 100vh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  padding: 2rem 1rem;
  background: var(--poly-surface);
  color: var(--poly-ink);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Inter, sans-serif;
  text-align: center;
}

@media (prefers-color-scheme: dark) {
  .poly-error {
    --poly-ink: #f2f4f8;
    --poly-ink-muted: #aeb7c6;
    --poly-accent: #6b8fd4;
    --poly-caption: #8a94a6;
    --poly-on-accent: #0f1526;
    --poly-accent-tint: #232b42;
    --poly-surface: #121318;
    --poly-surface-raised: #1b1d24;
    --poly-border: #2a2d36;
  }
}

.poly-error-card {
  width: 100%;
  max-width: 28rem;
  padding: 2.5rem 2rem;
  border: 1px solid var(--poly-border);
  border-radius: 1rem;
  background: var(--poly-surface-raised);
}

.poly-error-mark {
  width: 3.5rem;
  height: 3.5rem;
  margin: 0 auto 1.25rem;
  color: var(--poly-ink);
}

.poly-error-code {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.3em;
  color: var(--poly-caption);
}

.poly-error-title {
  margin: 0.5rem 0 0.75rem;
  font-family: Lora, Georgia, "Times New Roman", serif;
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.2;
}

.poly-error-detail {
  margin: 0;
  line-height: 1.6;
  color: var(--poly-ink-muted);
}

.poly-error-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1.75rem;
}

.poly-error-button {
  display: inline-block;
  padding: 0.6rem 1.1rem;
  border: 1px solid var(--poly-border);
  border-radius: 0.5rem;
  background: transparent;
  color: var(--poly-ink);
  font: inherit;
  font-size: 0.9rem;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
}

.poly-error-button:hover {
  background: var(--poly-accent-tint);
}

.poly-error-button--primary {
  border-color: var(--poly-accent);
  background: var(--poly-accent);
  color: var(--poly-on-accent);
}

.poly-error-button--primary:hover {
  background: var(--poly-accent);
  opacity: 0.9;
}

.poly-error-button:focus-visible {
  outline: 2px solid var(--poly-accent);
  outline-offset: 2px;
}

.poly-error-footer {
  margin: 0;
  font-family: Lora, Georgia, "Times New Roman", serif;
  font-size: 0.95rem;
  letter-spacing: 0.04em;
  color: var(--poly-caption);
}
</style>
