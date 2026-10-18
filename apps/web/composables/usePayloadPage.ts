// Shared by pages/index.vue (slug "/") and pages/[...slug].vue (everything
// else) so the homepage is fetched from Payload the same way as any other
// page, rather than being a hardcoded special case.
//
// Server-side (SSR) and client-side calls need different base URLs: SSR runs
// inside the web container, where "localhost" means the container
// itself, not the cms container — the actual bug this comment
// documents, caught by a real 404 when the homepage started calling this.
// The client-facing base is a relative /api path instead, proxied to
// cms by Caddy, so the browser never needs to resolve a
// Docker-internal hostname.
import type { PayloadPage, PayloadRedirect } from "../types/payload";

export async function usePayloadPage(slug: string) {
  // Captured synchronously, before any await, so it's available to restore
  // context later -- confirmed for real in this project's dev stack that
  // Nuxt's ambient instance context does NOT reliably survive a second
  // sequential composable call in one async function, only the first
  // (NUXT_E1001 "called outside of a plugin... Vue setup function" thrown
  // from the third composable call here, useSite/useFetch/useFetch, with
  // the first two having already resolved fine). `runWithContext` below is
  // Nuxt's own documented fix for exactly this.
  const nuxtApp = useNuxtApp();
  const config = useRuntimeConfig();
  const base = import.meta.server ? config.apiBaseInternal : config.public.apiBase;

  // Multi-tenant site resolution: a slug alone isn't unique across sites
  // ("about-us" can exist once per site), so every lookup is scoped to the
  // Site whose `domain` matches the request's own hostname -- isomorphic
  // (works identically during SSR, off the incoming request, and client-side,
  // off window.location). Matches Pages.ts's per-site slug-uniqueness
  // validation on the CMS side: together they guarantee this query returns
  // at most one page.
  const hostname = useRequestURL().hostname;
  const lang = useSiteLanguage();

  // Explicit key, keyed by slug: useFetch's default auto-key is derived from
  // the URL string alone ("${base}/pages"), which is identical for every
  // slug -- without this, a client-side navigation between two pages (e.g.
  // "/" then "/about-us") reuses the first page's cached response instead of
  // refetching, and the second page 404s. Caught for real: navigating
  // in-app from the homepage to another page kept resolving to whatever
  // page loaded first.
  // In a language other than the site's default, a page can have its own address (translatedSlug, /fr/a-propos), so the lookup asks for
  // both: the page whose address in this language is the one asked for, and the page whose shared address it is (the old address,
  // which then redirects to the translated one). The default language never looks at translated addresses.
  const translatedLookup = lang.code.value !== lang.defaultCode.value;
  const { data: page } = await useFetch(`${base}/pages`, {
    key: `payload-page-${lang.code.value}-${slug}`,
    query: {
      ...(translatedLookup
        ? { "where[and][0][or][0][translatedSlug][equals]": slug, "where[and][0][or][1][slug][equals]": slug }
        : { "where[and][0][slug][equals]": slug }),
      "where[and][1][site.domain][equals]": hostname,
      depth: 1,
      limit: translatedLookup ? 2 : 1,
      ...lang.query(),
    },
    transform: (res: { docs?: PayloadPage[] }) => pickPage(res?.docs ?? [], slug, translatedLookup),
  });

  // Found by the shared address, but the page has its own address in this language: send visitors (and search engines) there.
  const ownAddress = translatedLookup ? page.value?.translatedSlug : null;
  if (page.value && ownAddress && ownAddress !== slug) {
    await nuxtApp.runWithContext(() => navigateTo(lang.localePath(pageHref(ownAddress)), { redirectCode: 301 }));
    return page;
  }

  if (!page.value) {
    // Every composable call from here on is wrapped in runWithContext (see
    // this function's top comment) -- this is the second and third
    // sequential composable call in this function, past the point context
    // reliably survives on its own in this project's dev stack.
    const site = await nuxtApp.runWithContext(() => useSite());

    // Per-site kill switch (Sites.enabledModules) -- disabling "redirects"
    // on a site means that site's visitors get plain 404s, same as before
    // this feature existed, without touching the Redirects collection
    // itself or any other site's behavior.
    const redirectsEnabled = site.value?.enabledModules?.includes("redirects");

    const { data: redirect } = redirectsEnabled
      ? await nuxtApp.runWithContext(() =>
          useFetch(`${base}/redirects`, {
            key: `payload-redirect-${lang.code.value}-${slug}`,
            query: {
              // In another language, an address that changed there is recorded as "<language>/<address>".
              ...(translatedLookup
                ? { "where[and][0][fromPath][in]": `${lang.code.value}/${slug},${slug}`, ...lang.query() }
                : { "where[and][0][fromPath][equals]": slug }),
              "where[and][1][site.domain][equals]": hostname,
              "where[and][2][enabled][equals]": true,
              depth: 2,
              limit: translatedLookup ? 2 : 1,
            },
            transform: (res: { docs?: PayloadRedirect[] }) => pickRedirect(res?.docs ?? [], `${lang.code.value}/${slug}`),
          }),
        )
      : { data: { value: null } };

    const target = resolveRedirectTarget(redirect.value, translatedLookup);
    if (target) {
      // navigateTo performs the real redirect here (a server-side
      // sendRedirect during SSR, a router navigation client-side) -- Vue's
      // <script setup> compiler in this project doesn't support a bare
      // top-level `return` to short-circuit rendering, so callers
      // (pages/index.vue, pages/[...slug].vue) don't special-case this;
      // whatever they do next with a still-null `page.value` never reaches
      // the visitor.
      await nuxtApp.runWithContext(() =>
        navigateTo(target.external ? target.href : lang.localePath(target.href), { redirectCode: target.statusCode, external: target.external }),
      );
      return page;
    }

    throw createError({ statusCode: 404, statusMessage: "Page not found" });
  }

  return page;
}

// The page a lookup found: the one with this address in the language asked for, else the one whose shared address it is.
export function pickPage(docs: PayloadPage[], slug: string, translatedLookup: boolean): PayloadPage | null {
  if (!translatedLookup) return docs[0] ?? null;
  return docs.find((d) => d.translatedSlug === slug) ?? docs.find((d) => d.slug === slug) ?? null;
}

// A redirect for the exact address in this language wins over one for the plain address.
export function pickRedirect(docs: PayloadRedirect[], languageAddress: string): PayloadRedirect | null {
  return docs.find((d) => d.fromPath === languageAddress) ?? docs[0] ?? null;
}

// "/" is the homepage's own slug (see pages/index.vue) -- same special-case
// the Live Preview URL builder in payload.config.ts already uses.
export function pageHref(slug: string): string {
  return slug === "/" ? "/" : `/${slug.replace(/^\//, "")}`;
}

// Pure data transformation, no composables -- real redirects only (see
// docs/ARCHITECTURE.md), no silent same-URL rewrites, so every
// match here always ends in navigateTo, never a page render that keeps
// this URL in the address bar. Exported for unit testing (see
// usePayloadPage.test.ts) -- not used by any other caller.
export function resolveRedirectTarget(
  redirect: PayloadRedirect | null | undefined,
  // In a language other than the default, a page that has its own address there is redirected to that one.
  translated = false,
): { href: string; statusCode: number; external: boolean } | null {
  if (!redirect) return null;
  const statusCode = Number(redirect.statusCode) || 301;

  if (redirect.redirectType === "external") {
    return redirect.toUrl ? { href: redirect.toUrl, statusCode, external: true } : null;
  }

  const target = redirect.toTarget;
  if (!target || typeof target.value !== "object") return null;

  if (target.relationTo === "pages") {
    const targetSlug = (translated && target.value.translatedSlug) || target.value.slug;
    return targetSlug ? { href: pageHref(targetSlug), statusCode, external: false } : null;
  }

  if (target.relationTo === "media") {
    return target.value.url ? { href: target.value.url, statusCode, external: false } : null;
  }

  if (target.relationTo === "forms") {
    const landingSlug = typeof target.value.landingPage === "object" ? target.value.landingPage?.slug : null;
    return landingSlug ? { href: pageHref(landingSlug), statusCode, external: false } : null;
  }

  return null;
}
