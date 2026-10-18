import type { PayloadRequest } from "payload";

import { languageSettingOf, offeredBy, previewLanguagesOf } from "../i18n/registry";
import { PREVIEW_PARAM, signPreview } from "../i18n/previewToken";
import { addressIn } from "../i18n/translatedSlug";

// The public URL of a Page, built from the page's own Site (not the global
// SITE_DOMAIN env var, which is just the first dev site) so the SEO preview
// and Live Preview point at the right host on a multisite install.
export function buildPageUrl(domain: string, slug: unknown, scheme = "http", language?: { code?: string; token?: string }): string {
  const base = `${scheme}://${domain}`;
  const path = [language?.code, typeof slug === "string" ? slug.replace(/^\/+/, "") : ""].filter(Boolean).join("/");
  const query = language?.token ? `?${PREVIEW_PARAM}=${language.token}` : "";
  return `${path ? `${base}/${path}` : base}${query}`;
}

/**
 * The language part of a preview address. A language other than the site's default gets its prefix (/fr/about); a language the site
 * has set to preview only is not reachable by visitors, so its address also carries a signed, short-lived token that lets this one
 * request through (apps/web/utils/previewLanguage.ts). A language the site does not offer, or none, gives the default address.
 */
export async function languageForPreview(
  setting: unknown,
  locale: string | null | undefined,
  domain: string,
  secret = process.env.REVALIDATE_SECRET || "",
): Promise<{ code?: string; token?: string }> {
  const offered = offeredBy(setting);
  if (!locale || locale === offered[0] || !offered.includes(locale)) return {};
  const hidden = previewLanguagesOf(setting).includes(locale);
  return hidden && secret ? { code: locale, token: await signPreview(secret, domain, locale) } : { code: locale };
}

export async function pageUrlFromDoc(
  doc: { site?: unknown; slug?: unknown; translatedSlug?: unknown } | undefined,
  req: PayloadRequest | undefined,
  locale?: string | null,
): Promise<string> {
  const scheme = process.env.SITE_SCHEME || "http";
  const ref = doc?.site;
  const siteId = ref && typeof ref === "object" ? (ref as { id?: unknown }).id : ref;

  let domain = process.env.SITE_DOMAIN || "localhost";
  let setting: unknown;
  if (siteId && req?.payload) {
    const site = await req.payload
      .findByID({ collection: "sites", id: siteId as number | string, depth: 0, overrideAccess: true })
      .catch(() => null);
    if (site?.domain) domain = site.domain;
    setting = languageSettingOf(site);
  }
  const language = await languageForPreview(setting, locale, domain);
  // A page with its own address in this language is previewed there.
  return buildPageUrl(domain, language.code ? addressIn(doc ?? {}, language.code, offeredBy(setting)[0]!) : doc?.slug, scheme, language);
}
