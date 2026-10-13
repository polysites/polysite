// https://nuxt.com/docs/api/configuration/nuxt-config
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const configDirname = path.dirname(fileURLToPath(import.meta.url));

// WordPress-style theme auto-discovery -- the same scan
// apps/cms/src/collections/Sites.ts runs independently to build its Sites.theme
// dropdown. A directory `themes/polysite-theme-<name>/` is a valid theme
// when it has a `layouts/<name>.vue` (the same file the scan on the CMS
// side checks for); dropping one in extends this app's build automatically,
// no edit here needed. Runs once at Nuxt config load (dev server start /
// build time), not per-request.
function discoverThemePaths(): string[] {
  const themesDir = path.resolve(configDirname, "../../themes");
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(themesDir, { withFileTypes: true });
  } catch {
    // themes/ not mounted into this container, or no client theme repos
    // exist yet -- an empty `extends` is fine, not an error: this app's own
    // layouts/default.vue (a neutral fallback, not any specific client's
    // theme) still renders regardless of what's extended here.
    return [];
  }

  const paths: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(/^polysite-theme-(.+)$/);
    if (!match) continue;
    const value = match[1];
    if (fs.existsSync(path.join(themesDir, entry.name, "layouts", `${value}.vue`))) {
      paths.push(`../../themes/${entry.name}`);
    }
  }
  return paths.sort();
}

// A plugin can ship a web part: plugins/<name>/web with its own nuxt.config.ts, loaded as a Nuxt layer
// (pages, components, composables, server routes) exactly like a theme. Found the same way, once, at
// config load. A plugin with no web/ folder simply isn't a layer.
function discoverPluginLayerPaths(): string[] {
  const pluginsDir = path.resolve(configDirname, "../../plugins");
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
  } catch {
    return []; // plugins/ not mounted into this container: no plugin layers
  }
  const off = new Set((process.env.POLYSITE_PLUGINS_OFF ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  return entries
    .filter((e) => e.isDirectory() && !off.has(e.name) && fs.existsSync(path.join(pluginsDir, e.name, "web", "nuxt.config.ts")))
    .map((e) => `../../plugins/${e.name}/web`)
    .sort();
}

// Tailwind v4 skips nested git repositories (every theme and plugin layer is one), and a glob in the CSS did not bring the client
// themes back, so a class used only in one of them (ml-auto, z-40, w-80) generated nothing. The layers found above are written out
// by name into a file the stylesheet imports (assets/css/layer-sources.css, git-ignored, rewritten on every start), which does work.
function writeLayerSources(layerPaths: string[]): void {
  const lines = layerPaths.map((p) => `@source "../../${p}";`);
  const file = path.resolve(configDirname, "assets/css/layer-sources.css");
  const text = `/* Written by nuxt.config.ts from the theme and plugin layers found at start. Do not edit. */\n${lines.join("\n")}\n`;
  try {
    if (!fs.existsSync(file) || fs.readFileSync(file, "utf-8") !== text) fs.writeFileSync(file, text);
  } catch {
    // A read-only checkout still builds: the globs in main.css remain as the fallback.
  }
}
const LAYER_PATHS = [...discoverThemePaths(), ...discoverPluginLayerPaths()];
writeLayerSources(LAYER_PATHS);

// theme.json `parent` links: a theme that doesn't supply a block inherits it
// from its parent (e.g. a client theme built on the starter). Read once at config
// load, the same scan as above, and handed to the renderer through runtimeConfig.
function discoverThemeParents(): Record<string, string> {
  const themesDir = path.resolve(configDirname, "../../themes");
  const parents: Record<string, string> = {};
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(themesDir, { withFileTypes: true });
  } catch {
    return parents;
  }
  for (const entry of entries) {
    const match = entry.isDirectory() && entry.name.match(/^polysite-theme-(.+)$/);
    if (!match) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(themesDir, entry.name, "theme.json"), "utf-8"));
      if (typeof meta.parent === "string" && meta.parent) parents[match[1]] = meta.parent;
    } catch {
      // no theme.json, or unparsable -- the theme simply has no parent
    }
  }
  return parents;
}

export default defineNuxtConfig({
  compatibilityDate: "2026-09-19",
  devtools: { enabled: true },

  // @nuxt/ui (already a module below) pulls in Tailwind CSS v4 + its Vite
  // plugin as its own dependency -- this is the only extra wiring needed to
  // turn utility classes on project-wide; no separate @nuxtjs/tailwindcss
  // install required.
  css: ["~/assets/css/main.css"],

  // Theme block components are looked up by name at render time (see
  // utils/resolveBlock.ts), which only finds components registered globally.
  components: { global: true, dirs: ["~/components"] },

  // Docker Desktop's bind mount (docker-compose.dev.yml) doesn't propagate
  // native filesystem events from the Windows host into the Linux
  // container -- Vite's default watcher (chokidar, inotify-based) silently
  // never fires, so `nuxt dev` keeps serving stale component output until
  // the container is restarted. Verified for real: edited TextBlock.vue,
  // requests kept returning the old markup until this was added. Polling is
  // pure dev-server config (`vite.server`), so it's a no-op for `nuxt build`.
  vite: {
    server: {
      watch: { usePolling: true },
    },
  },

  // @nuxt/test-utils and eslint-plugin-vuejs-accessibility are deliberately
  // NOT listed here: the former is used directly in test files (no runtime
  // module needed), the latter is an ESLint plugin wired into eslint.config.mjs
  // via @nuxt/eslint, not a Nuxt module in its own right.
  modules: [
    "@nuxt/eslint",
    "@nuxt/icon",
    "@nuxt/image",
    "@nuxt/fonts",
    "@nuxt/scripts",
    "@nuxt/ui",
    "@nuxtjs/seo",
    "@nuxtjs/partytown",
    "@vee-validate/nuxt",
    "@vueuse/nuxt",
    "nuxt-security",
  ],

  // @nuxtjs/seo builds canonical URLs, og:url, the sitemap and robots.txt from
  // the site URL. Deliberately not set here: a build-time value is baked into the
  // image, so every site on a multisite install would claim the same URL (and an
  // image built without SITE_DOMAIN says http://localhost). Left unset, the
  // module derives it per request from the Host and X-Forwarded-* headers, which
  // is the right answer for each site.
  site: {
    name: "Polysite",
  },

  // The sitemap lists what the requesting site answers to (its published pages and any plugin's public content),
  // read from the CMS's URL index; see server/api/__sitemap__/urls.ts.
  sitemap: {
    sources: ["/api/__sitemap__/urls"],
  },

  // @nuxt/icon fetches icons that aren't bundled into the client from a Nitro
  // endpoint, `/api/_nuxt_icon` by default -- but Caddy sends every `/api/*`
  // request to Payload, which 404s it (the close "x" in the drawer never
  // rendered). Moving it outside `/api` lets it fall through to this server.
  icon: { localApiEndpoint: "/_nuxt_icon" },

  // nuxt-security's default headers block framing (X-Frame-Options /
  // frame-ancestors) by default, which would break Live Preview -- Payload's
  // admin (a different origin, {$CMS_DOMAIN}) needs to iframe this site.
  // The admin's origin is NOT written here: this file runs when the image is built, and a published image is built once, before anyone
  // knows the domain it will run on. server/plugins/frameAncestors.ts adds it to the header at run time, from NUXT_CMS_ORIGIN or
  // CMS_SCHEME and CMS_DOMAIN. Built in, the page can only be framed by itself.
  security: {
    // nuxt-security's own limiter (150 requests per 5 minutes per address, on every route, fixed) is replaced by
    // server/middleware/rateLimit.ts, which has sane defaults for a public site and can be set from the environment.
    rateLimiter: false,
    headers: {
      xFrameOptions: false,
      contentSecurityPolicy: {
        // Images may come from any https host (editors paste image links; a plugin's tracking pixels report as images).
        "img-src": ["'self'", "data:", "https:"],
        "frame-ancestors": ["'self'"],
      },
    },
  },

  // Presentation (branding, page layout, and any client-only pages or
  // components) lives in separate theme repos, each extended as its own Nuxt
  // layer rather than living in this core app.
  //
  // Every valid theme folder under themes/ is discovered and listed here at
  // once (discoverThemePaths() above), not one chosen per deployment --
  // which theme actually renders for a given request is
  // runtime data (Sites.theme), resolved by app.vue picking a layout BY
  // NAME (<NuxtLayout :name="site.theme">). This only works because each
  // theme names its layout file after itself (layouts/acme.vue,
  // layouts/bakery.vue) instead of Nuxt's `default.vue` convention -- two
  // themes both using `default.vue` would collide, only one would win.
  // Dropping in a new theme folder (with a matching layouts/<name>.vue)
  // extends this app's build automatically on next restart; it never means
  // a new container, since one running Nuxt app already contains every
  // theme's code.
  //
  // Local paths on purpose, not `extends: ["github:org/theme"]`: that form
  // fetches the layer over HTTPS through GitHub's API, which can't see a
  // private repository (it gets a 404) and doesn't use the SSH deploy key
  // the rest of the deployment relies on.
  extends: LAYER_PATHS,

  runtimeConfig: {
    // Server-only: used by the revalidate webhook handler to authenticate
    // Payload's publish webhook. Maps from NUXT_REVALIDATE_SECRET.
    revalidateSecret: "",
    // Server-only: SSR fetches call Payload directly over the Docker
    // network by service name. Maps from NUXT_API_BASE_INTERNAL.
    apiBaseInternal: "http://cms:3001/api",
    public: {
      // Client-side fetches use this relative path instead, which Caddy
      // proxies to cms — the browser never needs to resolve a
      // Docker-internal hostname. Maps from NUXT_PUBLIC_API_BASE.
      apiBase: "/api",
      // Child theme -> parent theme, from each themes/*/theme.json.
      themeParents: discoverThemeParents(),
      // Reuses the same CMS_SCHEME/CMS_DOMAIN env vars Caddy and
      // payload.config.ts's livePreview.url already use — no new env var.
      // useLivePreview (in [...slug].vue) checks postMessage events against
      // this origin, so it must be the URL as the *browser* sees the admin
      // panel, not a Docker-internal address.
      cmsServerUrl: `${process.env.CMS_SCHEME || "http"}://${process.env.CMS_DOMAIN || "admin.localhost"}`,
    },
  },

  // No build-time nitro.prerender routes: "/" fetches its content from
  // Payload's API, which isn't reachable during the isolated Docker build
  // step (a real build failure this caused, not a hypothetical one — the
  // build tried to prerender "/" with no CMS to call and failed with a 404).
  // Every content page, "/" included, renders on first request instead and
  // is cached per the routeRules below.

  routeRules: {
    // Static/informational and news pages: cache indefinitely (isr: true),
    // invalidated on demand by the /api/revalidate webhook handler when an
    // editor publishes a change in Payload. This is the concrete mechanism
    // behind "publishing triggers a background cache revalidation" in the
    // the requirements — Nuxt/Nitro doesn't have Next.js-style ISR as a turnkey default,
    // so this route rule + the webhook handler together are what implement it.
    "/**": { isr: true },
  },
});
