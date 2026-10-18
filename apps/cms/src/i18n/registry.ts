import type { Payload } from "payload";

import { DEFAULT_LANGUAGE } from "./catalog";

// Which languages a site offers is a per-site choice that a plugin supplies; the core only knows the contract. A plugin that
// keeps per-site settings in its own collection (plugins/siteSettings.ts) publishes some of them on the site as
// `site.extensions.<key>`; the key `languages` is this module's: `{ languages: ["fr", "en"], defaultLanguage: "fr" }`. Any
// plugin may supply it (the i18n plugin does). When nothing does, a site offers English only. A remembered Payload instance is
// needed because the search plugin's `skipSync` callback is not handed one.
let remembered: Payload | undefined;

export const rememberPayload = (payload: Payload): void => {
  remembered = payload;
};

/** The key under `site.extensions` that carries a site's language choice. */
export const LANGUAGES_EXTENSION = "languages";

/**
 * The languages a site offers, the default first, from its `extensions.languages` setting. Anything missing or malformed means
 * English only; a default that is not among the listed languages is replaced by the first listed.
 */
export function offeredBy(setting: unknown): string[] {
  const raw = (setting as { languages?: unknown } | null | undefined)?.languages;
  const listed = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string" && c.length > 0) : [];
  if (listed.length === 0) return [DEFAULT_LANGUAGE];
  const wanted = (setting as { defaultLanguage?: unknown }).defaultLanguage;
  const def = typeof wanted === "string" && listed.includes(wanted) ? wanted : listed[0]!;
  return [def, ...listed.filter((c) => c !== def)];
}

/** The language setting carried by a site document (`site.extensions.languages`), if any. */
export const languageSettingOf = (site: unknown): unknown => (site as { extensions?: Record<string, unknown> } | null | undefined)?.extensions?.[LANGUAGES_EXTENSION];

// A site is read once per request (a search sync asks once for every catalog language), not once per question.
const perRequest = new WeakMap<object, Map<string, Promise<string[]>>>();

export async function languagesFor(siteId: unknown, req?: object): Promise<string[]> {
  if (!remembered || siteId === undefined || siteId === null) return [DEFAULT_LANGUAGE];
  const payload = remembered;
  const read = async (): Promise<string[]> => {
    try {
      const site = await payload.findByID({ collection: "sites", id: siteId as number | string, depth: 0, overrideAccess: true, ...(req ? { req: req as never } : {}) });
      return offeredBy(languageSettingOf(site));
    } catch {
      return [DEFAULT_LANGUAGE];
    }
  };
  if (!req) return read();
  let cache = perRequest.get(req);
  if (!cache) perRequest.set(req, (cache = new Map()));
  const key = String(siteId);
  if (!cache.has(key)) cache.set(key, read());
  return cache.get(key)!;
}

// Whether the language being written is the default of the document's site. A translatable field that is required is only required
// there: a translator saving the French page must not have to fill in every required field before the first French save works.
export async function isDefaultLanguageHere(options: {
  req?: { locale?: string | null };
  data?: Record<string, unknown>;
  id?: unknown;
  collectionSlug?: string;
}): Promise<boolean> {
  const locale = options.req?.locale || DEFAULT_LANGUAGE;
  const data = options.data ?? {};
  // A site document is its own site; anything else asks the site it belongs to.
  const siteId = options.collectionSlug === "sites" ? (options.id ?? data.id) : idOf(data.site);
  const offered = await languagesFor(siteId, options.req);
  return locale === offered[0];
}

const idOf = (ref: unknown): unknown => (ref && typeof ref === "object" ? (ref as { id?: unknown }).id : ref);

// For the search plugin's `skipSync`: write an index entry for a language only when the document's site offers it.
export async function skipsLanguage(doc: Record<string, unknown> | undefined, locale: string | undefined, req?: object): Promise<boolean> {
  if (!locale) return false;
  const offered = await languagesFor(idOf(doc?.site), req);
  return !offered.includes(locale);
}

// Which languages a document has text in: the languages with a non-empty title. Read from the "all languages" form of the document.
export function translatedLanguages(title: unknown): string[] {
  if (!title || typeof title !== "object") return [];
  return Object.entries(title as Record<string, unknown>)
    .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
    .map(([code]) => code);
}

/** The languages a site has set to preview only (`extensions.languages.previewLanguages`): editors write them, visitors cannot reach them. Never the default. */
export function previewLanguagesOf(setting: unknown): string[] {
  const raw = (setting as { previewLanguages?: unknown } | null | undefined)?.previewLanguages;
  const [def, ...rest] = offeredBy(setting);
  return Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string" && c !== def && rest.includes(c)) : [];
}
