<script setup lang="ts">
// The core app's OWN generic fallback layout -- not a client theme, lives
// in apps/web itself rather than themes/. This is what WordPress core does
// with its own bundled default theme: a neutral, unbranded layout that
// exists purely so the app always has *something* safe to render, with no
// specific client's identity baked into it.
//
// Nuxt auto-registers any layouts/default.vue as the layout named "default"
// with zero `extends` wiring needed -- it exists regardless of which (if
// any) client theme repos are present in themes/. app.vue falls back to
// this by name (site.theme || "default") when a Site has no theme set, and
// nuxt.config.ts's theme-repo scan falls back to an empty `extends` array
// (rather than hardcoding a specific client's theme path) when it finds no
// valid theme repos at all -- this layout is what actually renders in that
// case, not a client theme standing in as a fake "safe" default.
//
// Deliberately plain: a single-row header, a simple footer, no drawer/
// masthead/any other structural opinion a real client theme would have.
// Still fully functional -- reuses the shared useSiteBranding() composable
// so whatever IS configured on a Site (colors, nav, footer, social links)
// still applies even when no client theme matches.
const site = await useSite();
const localePath = useLocalePath();
const { siteName, tagline, showDonateButton, brandVars, navItems, footerColumns, socialLinks, socialIcons } =
  useSiteBranding(site);
</script>

<template>
  <div class="site-shell min-h-screen bg-white text-neutral-900" :style="brandVars">
    <header class="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 px-4 py-4 sm:px-8">
      <NuxtLink :to="localePath('/')" class="flex items-center gap-2">
        <img v-if="site?.logo?.url" :src="site.logo.url" :alt="siteName" class="h-8 w-auto" >
        <span v-else class="text-lg font-bold text-[var(--brand-primary)]">{{ siteName }}</span>
        <span v-if="tagline" class="hidden text-sm text-neutral-500 sm:inline">{{ tagline }}</span>
      </NuxtLink>
      <nav class="flex flex-wrap items-center gap-4">
        <NuxtLink
          v-for="item in navItems"
          :key="item.label"
          :to="localePath(item.href)"
          class="text-sm font-medium text-neutral-700 hover:text-[var(--brand-primary)]"
        >
          {{ item.label }}
        </NuxtLink>
        <NuxtLink
          v-if="showDonateButton"
          to="/donate"
          class="rounded-full bg-[var(--brand-primary)] px-4 py-1.5 text-sm font-bold text-white hover:opacity-90"
        >
          Donate
        </NuxtLink>
      </nav>
      <SiteSlot name="language-switcher" />
    </header>

    <slot />

    <footer class="border-t border-neutral-200 bg-neutral-50 px-4 py-10 sm:px-8">
      <div class="mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-8">
        <div v-for="col in footerColumns" :key="col.heading">
          <h4 class="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-500">{{ col.heading }}</h4>
          <ul class="flex flex-col gap-1.5 text-sm">
            <li v-for="l in col.links ?? []" :key="l.label">
              <NuxtLink :to="localePath(l.href)" class="text-neutral-700 hover:text-[var(--brand-primary)]">{{ l.label }}</NuxtLink>
            </li>
          </ul>
        </div>
        <div class="flex gap-3">
          <a
            v-for="s in socialLinks"
            :key="s.platform"
            :href="s.url"
            :aria-label="`${s.platform} (demo link)`"
            class="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-neutral-600 hover:bg-[var(--brand-primary)] hover:text-white"
          >
            <Icon :name="socialIcons[s.platform] ?? 'lucide:link'" size="14" />
          </a>
        </div>
      </div>
      <p class="mx-auto mt-8 max-w-5xl text-xs text-neutral-400">
        &copy; {{ new Date().getFullYear() }} {{ siteName }}
        <TrackingSettingsLink class="ms-3" />
      </p>
    </footer>
  </div>
</template>
