import type { PayloadSite } from "../types/payload";
import { languagesOf, SYSTEM_DEFAULT, splitLanguage } from "../utils/language";
import { PREVIEW_PARAM, verifyPreview } from "../utils/previewLanguage";

// Site-level branding (logo, favicon, colors, header nav, footer columns,
// social links) -- lives on the Sites collection (apps/cms/src/collections/
// Sites.ts's "Branding" tab), fetched the same way usePayloadPage resolves
// which Site a request belongs to: by the request's own hostname, isomorphic
// across SSR and client-side navigation.
//
// A site can offer several languages (the i18n plugin). The first request is always in English and also says which languages the
// site offers; if the address asks for another language, or the site's own default is not English, the same site is read
// again in that language so its tagline and menu labels are translated. A site with one language makes one request, as before.
export async function useSite() {
  const nuxtApp = useNuxtApp();
  const config = useRuntimeConfig();
  const route = useRoute();
  // Composables must be called before the first await: after it Nuxt no longer knows which request this is.
  const languageSetup = useLanguageSetup();
  // A language the site has set to "preview only" is reachable through a signed link (?_pl=...) made by the CMS. The check happens on the
  // server, once; the result rides along in the page payload so the browser agrees with it after hydration.
  const previewLanguages = useState<string[]>("polysite-preview-languages", () => []);
  const base = import.meta.server ? config.apiBaseInternal : config.public.apiBase;
  const hostname = useRequestURL().hostname;

  const fetchSite = (key: string, extra: Record<string, string> = {}) =>
    useFetch(`${base}/sites`, {
      key,
      // app.vue and the layout both call useSite() in one render; without this
      // the second call re-fetches (a same-key request replaces the first) and
      // every page view hits Payload twice for the same Site.
      getCachedData: (cacheKey, app) => app.payload.data[cacheKey] ?? app.static.data[cacheKey],
      query: {
        "where[domain][equals]": hostname,
        depth: 1,
        limit: 1,
        ...extra,
      },
      transform: (res: { docs?: PayloadSite[] }) => res?.docs?.[0] ?? null,
    });

  const { data: first } = await fetchSite(`site-${hostname}`);

  if (import.meta.server && route.query[PREVIEW_PARAM] !== undefined) {
    const opened = await verifyPreview(config.revalidateSecret as string, hostname, route.query[PREVIEW_PARAM], Date.now());
    if (opened) {
      previewLanguages.value = [opened];
      // Never stored by the page cache, never indexed.
      nuxtApp.runWithContext(() => {
        useResponseHeader("Cache-Control").value = "private, no-store";
        useHead({ meta: [{ name: "robots", content: "noindex, nofollow" }] });
      });
    }
  }
  const setup = languagesOf(first.value, previewLanguages.value);
  languageSetup.value = setup;
  const { code } = splitLanguage(route.path, setup);
  if (code === SYSTEM_DEFAULT) return first;

  const { data: localized } = await nuxtApp.runWithContext(() =>
    fetchSite(`site-${hostname}-${code}`, { locale: code, "fallback-locale": setup.default }),
  );
  return localized;
}
