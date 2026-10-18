import type { PayloadSite } from "../types/payload";

// Languages on the public site. A site offers one language (English) unless a plugin (i18n) has given it more, as `site.extensions.languages`. Everything here
// is plain data in, plain data out, so each rule is tested without Nuxt.
//
// An address carries its language as a first segment: /fr/about is the French "about". The site's default language has no
// segment (/about), so a site that adds a second language keeps every existing address working.

export interface SiteLanguage {
  code: string;
}

export interface LanguageSetup {
  /** The site's default language: addresses without a prefix, and what a missing translation falls back to. */
  default: string;
  /** Every language the site offers, the default included, default first. */
  languages: string[];
  /** Languages the site has set to preview only: written by editors, not served to visitors. Only present when there are some. */
  preview?: string[];
}

export const SYSTEM_DEFAULT = "en";
export const SINGLE_LANGUAGE: LanguageSetup = { default: SYSTEM_DEFAULT, languages: [SYSTEM_DEFAULT] };

const RIGHT_TO_LEFT = new Set(["ar", "he", "fa", "ur", "ps", "sd", "yi", "dv", "ug", "ku"]);

export const isRtl = (code: string): boolean => RIGHT_TO_LEFT.has(code.split("-")[0]!.toLowerCase());

export const directionOf = (code: string): "rtl" | "ltr" => (isRtl(code) ? "rtl" : "ltr");

// A language's name in itself ("français"), from the browser's and Node's own data; no list of names to keep.
export function nameOf(code: string): string {
  try {
    const name = new Intl.DisplayNames([code], { type: "language" }).of(code);
    return name ? name.charAt(0).toLocaleUpperCase(code) + name.slice(1) : code;
  } catch {
    return code;
  }
}

/**
 * What a site says it offers: the core contract `site.extensions.languages` (`{ languages, defaultLanguage, previewLanguages }`), which any
 * plugin that keeps per-site settings may supply (the i18n plugin does). A site with nothing set offers English only. A language in
 * `previewLanguages` is written by editors but is not an address visitors can reach (no prefix, no switcher, no hreflang, no sitemap
 * entry); `allowed` makes some of them reachable for one request (a signed preview link, see utils/previewLanguage.ts). The default
 * language is never preview-only.
 */
export function languagesOf(site: Pick<PayloadSite, "extensions"> | null | undefined, allowed: readonly string[] = []): LanguageSetup {
  const choice = site?.extensions?.languages;
  const strings = (raw: unknown): string[] => (Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string" && c.length > 0) : []);
  const listed = strings(choice?.languages);
  if (listed.length === 0) return SINGLE_LANGUAGE;
  const wanted = typeof choice?.defaultLanguage === "string" ? choice.defaultLanguage : "";
  const def = listed.includes(wanted) ? wanted : listed[0]!;
  const hidden = strings(choice?.previewLanguages).filter((c) => c !== def && listed.includes(c) && !allowed.includes(c));
  const setup: LanguageSetup = { default: def, languages: [def, ...listed.filter((c) => c !== def && !hidden.includes(c))] };
  return hidden.length ? { ...setup, preview: hidden } : setup;
}

/**
 * Splits a request address into its language and the rest. Only a language the site offers, other than the default, counts as a
 * prefix; anything else is part of the address. `rest` has no slashes at the ends ("" is the home page).
 */
export function splitLanguage(path: string, setup: LanguageSetup): { code: string; rest: string } {
  const segments = path.split("?")[0]!.split("#")[0]!.split("/").filter(Boolean);
  const first = segments[0]?.toLowerCase();
  const match = first ? setup.languages.find((c) => c !== setup.default && c.toLowerCase() === first) : undefined;
  if (match) return { code: match, rest: segments.slice(1).join("/") };
  return { code: setup.default, rest: segments.join("/") };
}

const NOT_A_PAGE = /^(\/api\/|\/_nuxt\/|\/_ipx\/|\/__)/;

/**
 * Puts a language on an internal address. The default language, an address that already has a language, and anything that
 * isn't a page of this site (a full URL, mailto:, an anchor, the API) are left as they are.
 */
export function withLanguage(href: string, code: string, setup: LanguageSetup): string {
  if (!href.startsWith("/") || href.startsWith("//") || NOT_A_PAGE.test(href)) return href;
  if (code === setup.default) return href;
  const { code: already } = splitLanguage(href, setup);
  if (already !== setup.default) return href;
  return href === "/" ? `/${code}` : `/${code}${href}`;
}

/** The Payload query that asks for a language and falls back to the site's default. */
export function languageQuery(code: string, setup: LanguageSetup): Record<string, string> {
  return { locale: code, "fallback-locale": setup.default };
}

/**
 * The address of a page or item in a language, language prefix included. `base` is its shared address (the default language's, from the
 * URL index's `path`), `localized` the index's per-language addresses (`localizedPath` read with locale=all): a language whose entry
 * differs from the shared one has an address of its own (/fr/a-propos). Without one, the shared address is used under the prefix.
 */
export function addressInLanguage(base: string, localized: Record<string, string | null | undefined> | string | null | undefined, code: string, setup: LanguageSetup): string {
  const own = code !== setup.default && localized && typeof localized === "object" ? localized[code] : undefined;
  const path = own || base;
  return withLanguage(path.startsWith("/") ? path : `/${path}`, code, setup);
}
