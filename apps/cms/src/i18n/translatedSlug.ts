import { DEFAULT_LANGUAGE } from "./catalog";

// Translated page addresses. `pages.slug` stays the one shared address and the page's identity (it is the default language's address
// and what every older link points at); `pages.translatedSlug` is a localized field that gives a page its own address in another
// language, so /fr/a-propos can be the French /about. Empty means "use the shared slug", as before. Nothing is moved or dropped.

/**
 * One address segment per "/", lower case, with letters and digits from any script kept (an Arabic or Cyrillic address is a real
 * address) and everything else turned into a single hyphen. Slashes at the ends go. "/" (the home page) has no translated address: the
 * home page of a language is /fr, /ar.
 */
export function normalizeTranslatedSlug(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .map((segment) =>
      segment
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}\p{M}-]+/gu, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .filter(Boolean)
    .join("/");
}

/** The first segments the site itself answers to, which an address in a language must not take. */
const RESERVED_FIRST_SEGMENTS = new Set(["api", "admin", "_nuxt", "_ipx", "feed", "feed.xml", "sitemap", "sitemap.xml", "robots.txt", "__nuxt_error"]);

/** An error message, or null when the address can be used in `locale`. `offered` is the site's languages, default first. */
export function translatedSlugProblem(value: string, locale: string | undefined, offered: string[]): string | null {
  if (!value) return null;
  if (!locale || locale === (offered[0] ?? DEFAULT_LANGUAGE)) {
    return "The default language uses the Address above. Choose another language to give this page an address there.";
  }
  const first = value.split("/")[0]!;
  if (RESERVED_FIRST_SEGMENTS.has(first) || first.startsWith("__")) return `"${first}" is used by the site itself. Choose another.`;
  if (offered.some((code) => code.toLowerCase() === first.toLowerCase())) return `"${first}" is a language code, and would be read as a language. Choose another.`;
  return null;
}

/** The address a page has in a language (without the language prefix): its own when it has one there, else the shared slug. */
export function addressIn(
  doc: { slug?: unknown; translatedSlug?: unknown },
  locale: string | undefined,
  defaultLocale: string,
): string {
  const shared = typeof doc.slug === "string" ? doc.slug : "";
  if (!locale || locale === defaultLocale) return shared;
  const own = typeof doc.translatedSlug === "string" ? doc.translatedSlug.trim() : "";
  return own && shared !== "/" ? own : shared;
}

/**
 * The redirect that keeps an old translated address working: from "<language>/<old address>". The path includes the language because a
 * redirect is looked up by the address as the visitor typed it, and the same word can be a different page in another language.
 */
export function translatedRedirectFrom(locale: string, defaultLocale: string, before: string | undefined, after: string | undefined): string | null {
  if (!before || before === after || locale === defaultLocale) return null;
  return `${locale}/${before}`;
}
