// The URLs of the requesting site, for the sitemap. The site's own address list is the CMS's `site-urls` index (every
// page and every plugin's public content, kept up to date as content is saved), so the sitemap lists exactly what the
// site answers to with no list of routes written here. Redirects and drafts aren't published, so they never appear.
import { defineSitemapEventHandler } from "#imports";

import type { PayloadSite } from "../../../types/payload";
import { addressInLanguage, languagesOf } from "../../../utils/language";

interface SiteUrlDoc {
  path?: string | null;
  /** The languages this address has text in (the CMS keeps it up to date). */
  languages?: string[] | null;
  /** The address in each language (read with locale=all); a language without an address of its own has the shared one. */
  localizedPath?: Record<string, string | null> | string | null;
  updatedAt?: string | null;
  /** The document this address belongs to. Empty when that document has since been removed. */
  doc?: { value?: unknown } | null;
}

const PAGE_SIZE = 500;
const MAX_PAGES = 40; // 20,000 addresses is far beyond what one site here holds; stops a runaway loop

export default defineSitemapEventHandler(async (event) => {
  const base = useRuntimeConfig(event).apiBaseInternal;
  const hostname = getRequestURL(event).hostname;

  const sites = await $fetch<{ docs?: Array<Pick<PayloadSite, "extensions"> & { id: number }> }>(`${base}/sites`, {
    query: { "where[domain][equals]": hostname, depth: 0, limit: 1 },
  }).catch(() => null);
  const siteId = sites?.docs?.[0]?.id;
  if (!siteId) return [];
  // A site with more than one language lists every language of every page that has been translated, each with its alternatives
  // so search engines connect them. A site with one language lists plain addresses, as always.
  const setup = languagesOf(sites?.docs?.[0]);
  const origin = getRequestURL(event).origin;

  const urls: Array<{ loc: string; lastmod?: string; alternatives?: Array<{ hreflang: string; href: string }> }> = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await $fetch<{ docs?: SiteUrlDoc[]; hasNextPage?: boolean }>(`${base}/site-urls`, {
      query: {
        "where[site][equals]": siteId,
        "where[status][equals]": "published",
        depth: 0,
        limit: PAGE_SIZE,
        page,
        sort: "path",
        // Every language's own address, in one answer; only the fields the sitemap uses.
        ...(setup.languages.length > 1
          ? { locale: "all", "select[path]": true, "select[localizedPath]": true, "select[languages]": true, "select[updatedAt]": true, "select[doc]": true }
          : {}),
      },
    }).catch(() => null);
    for (const doc of res?.docs ?? []) {
      // An index entry whose document is gone (it was removed without going through the CMS) is not an address the
      // site answers to, so it must not be advertised: it would be a dead link in the sitemap.
      if (typeof doc.path !== "string" || !doc.doc?.value) continue;
      const path = doc.path.startsWith("/") ? doc.path : `/${doc.path}`;
      const lastmod = doc.updatedAt ? { lastmod: doc.updatedAt } : {};
      if (setup.languages.length === 1) {
        urls.push({ loc: path, ...lastmod });
        continue;
      }
      // The default language always has the address; another language only when it has been translated.
      const have = setup.languages.filter((code) => code === setup.default || (doc.languages ?? []).includes(code));
      const alternatives = [
        ...have.map((code) => ({ hreflang: code, href: `${origin}${addressInLanguage(path, doc.localizedPath, code, setup)}` })),
        { hreflang: "x-default", href: `${origin}${addressInLanguage(path, doc.localizedPath, setup.default, setup)}` },
      ];
      for (const code of have) urls.push({ loc: addressInLanguage(path, doc.localizedPath, code, setup), alternatives, ...lastmod });
    }
    if (!res?.hasNextPage) break;
  }
  return urls;
});
