// The pure part of the showcase seeder: turning a showcase/site.json into the data Payload stores, with the database lookups
// (media ids, form ids) handed in. Nothing here talks to Payload, so it is unit tested on its own (content.test.ts).
import { markupToLexical } from "./markup";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;

export const HOME_SLUG = "/";

/** The address the core stores for a page: `home` and `/` are the front page. */
export function pageSlug(slug: string): string {
  return slug === "home" || slug === "/" ? HOME_SLUG : slug;
}

/** `Open evenings & more` -> `open-evenings-more`. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Keys whose string value is a path to a picture under showcase/images/ (uploaded to Media, replaced by the media id). */
export const IMAGE_KEYS = ["image", "photo"] as const;

export interface ImageUse {
  /** `images/hero.svg`, as written in the file. */
  path: string;
  /** The alt text written beside it, when there is one. */
  alt?: string;
}

const isObject = (value: unknown): value is Record<string, Json> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The alt text written next to the picture under `key`: `<key>Alt` first, then `alt`. */
export function altBeside(holder: Record<string, Json>, key: string): string | undefined {
  const specific = holder[`${key}Alt`];
  if (typeof specific === "string" && specific) return specific;
  return typeof holder.alt === "string" && holder.alt ? holder.alt : undefined;
}

function walkImages(value: Json, out: ImageUse[]): void {
  if (Array.isArray(value)) {
    for (const item of value) walkImages(item, out);
  } else if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if ((IMAGE_KEYS as readonly string[]).includes(key) && typeof child === "string") out.push({ path: child, alt: altBeside(value, key) });
      else walkImages(child, out);
    }
  }
}

/** Every picture a showcase refers to, once each, in the order they appear. The first alt text found for a file is kept. */
export function collectImages(site: Json): ImageUse[] {
  const found: ImageUse[] = [];
  if (typeof site.logo === "string") found.push({ path: site.logo, alt: site.logoAlt ?? site.name });
  if (typeof site.favicon === "string") found.push({ path: site.favicon, alt: `${site.name} icon` });
  walkImages(site.pages ?? [], found);
  walkImages(site.posts ?? [], found);
  const byPath = new Map<string, ImageUse>();
  for (const use of found) {
    const known = byPath.get(use.path);
    if (!known) byPath.set(use.path, { ...use });
    else if (!known.alt && use.alt) known.alt = use.alt;
  }
  return [...byPath.values()];
}

/** A readable fallback alt text from a file name: `images/hero-salon.svg` -> `hero salon`. */
export function altFromPath(path: string): string {
  return path.replace(/^.*\//, "").replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim() || "picture";
}

export interface MapContext {
  /** The media id for a file path written in the showcase. */
  mediaId: (path: string) => number | string;
  /** The form id for a form key written in a block. */
  formId: (key: string) => number | string;
}

const FORM_BLOCKS = new Set(["formEmbed", "signupForm"]);

function mapValue(value: Json, ctx: MapContext, blockType?: string): Json {
  if (Array.isArray(value)) return value.map((item) => mapValue(item, ctx, blockType));
  if (!isObject(value)) return value;
  const out: Record<string, Json> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "alt" || key.endsWith("Alt")) continue; // beside a picture: goes to Media's alt, not to the block
    if ((IMAGE_KEYS as readonly string[]).includes(key) && typeof child === "string") out[key] = ctx.mediaId(child);
    else if (key === "form" && blockType && FORM_BLOCKS.has(blockType) && typeof child === "string") out[key] = ctx.formId(child);
    else if (key === "body" && blockType === "textBlock" && typeof child === "string") out[key] = markupToLexical(child);
    else out[key] = mapValue(child, ctx, blockType);
  }
  return out;
}

/** One block of a page as Payload stores it. */
export function mapBlock(block: Json, ctx: MapContext): Json {
  return mapValue(block, ctx, block.blockType as string);
}

/** The blocks of a page minus those Payload does not have (their plugin is not installed), and the slugs that were dropped. */
export function availableBlocks(blocks: Json[], installed: ReadonlySet<string>): { kept: Json[]; dropped: string[] } {
  const kept: Json[] = [];
  const dropped: string[] = [];
  for (const block of blocks) {
    if (installed.has(block.blockType)) kept.push(block);
    else dropped.push(block.blockType);
  }
  return { kept, dropped };
}

/**
 * Lays a translation over the default-language value by position. Objects merge field by field, arrays item by item (an item
 * the translation leaves out, `null` or `{}` keeps the default's), anything else is replaced. Used to build a full block list
 * in another language from the default blocks and the few fields the file translates.
 */
export function overlay(base: Json, over: Json): Json {
  if (over === undefined || over === null) return base;
  if (Array.isArray(base) && Array.isArray(over)) {
    const length = Math.max(base.length, over.length);
    return Array.from({ length }, (_, i) => (i < over.length ? overlay(base[i], over[i]) : base[i]));
  }
  if (isObject(base) && isObject(over)) {
    const out: Record<string, Json> = { ...base };
    for (const [key, child] of Object.entries(over)) out[key] = overlay(base[key], child);
    return out;
  }
  return over;
}

/**
 * Copies the ids of the rows (blocks, list items) of an existing document onto the same positions of new data, so that saving it
 * in another language updates the rows instead of adding new ones.
 */
export function withIds(next: Json, existing: Json): Json {
  if (Array.isArray(next)) {
    return next.map((item, i) => withIds(item, Array.isArray(existing) ? existing[i] : undefined));
  }
  if (!isObject(next)) return next;
  const out: Record<string, Json> = {};
  for (const [key, child] of Object.entries(next)) out[key] = withIds(child, isObject(existing) ? existing[key] : undefined);
  if (isObject(existing) && existing.id !== undefined && out.id === undefined) out.id = existing.id;
  return out;
}

/**
 * Whether `actual` (what Payload has) already holds everything in `desired`. Row ids and fields Payload adds on its own are
 * ignored; arrays must have the same length. This is how a re-run knows it has nothing to change.
 */
export function holds(actual: Json, desired: Json): boolean {
  if (Array.isArray(desired)) {
    return Array.isArray(actual) && actual.length === desired.length && desired.every((item, i) => holds(actual[i], item));
  }
  if (isObject(desired)) {
    if (!isObject(actual)) return false;
    return Object.entries(desired).every(([key, child]) => (key === "id" ? true : holds(actual[key], child)));
  }
  if (desired === undefined) return true;
  // A relationship read back at depth 0 is an id; at greater depth an object with an id.
  if (isObject(actual) && "id" in actual && (typeof desired === "number" || typeof desired === "string")) return String(actual.id) === String(desired);
  // A select stores its choices as text, so 3 and "3" are the same value.
  if ((typeof actual === "string" && typeof desired === "number") || (typeof actual === "number" && typeof desired === "string")) return String(actual) === String(desired);
  return actual === desired || (actual == null && desired == null);
}

/** The site document's own fields (Payload's `sites` collection) for a showcase, in its default language. */
export function siteFields(site: Json, domain: string, ctx: Pick<MapContext, "mediaId">): Json {
  return {
    name: site.name,
    domain,
    theme: site.theme,
    ...(site.tagline !== undefined ? { tagline: site.tagline } : {}),
    ...(site.primaryColor ? { primaryColor: site.primaryColor } : {}),
    ...(site.secondaryColor ? { secondaryColor: site.secondaryColor } : {}),
    ...(site.headingFontFamily ? { headingFontFamily: site.headingFontFamily } : {}),
    ...(site.bodyFontFamily ? { bodyFontFamily: site.bodyFontFamily } : {}),
    ...(site.logo ? { logo: ctx.mediaId(site.logo) } : {}),
    ...(site.favicon ? { favicon: ctx.mediaId(site.favicon) } : {}),
    showDonateButton: site.showDonateButton ?? false,
    headerNavItems: (site.header ?? []).map((item: Json) => ({ label: item.label, href: item.href })),
    footerColumns: (site.footer?.columns ?? []).map((col: Json) => ({
      heading: col.heading,
      links: (col.links ?? []).map((link: Json) => ({ label: link.label, href: link.href })),
    })),
    socialLinks: (site.social ?? []).map((s: Json) => ({ platform: s.platform, url: s.url })),
    ...(site.privacy?.policyUrl ? { privacyPolicyUrl: site.privacy.policyUrl } : {}),
    ...(site.privacy?.contactEmail ? { privacyContactEmail: site.privacy.contactEmail } : {}),
  };
}

/** The same fields in another language: only the words that are translated (tagline, menu labels, footer headings and links). */
export function siteTranslation(site: Json, lang: string): Json {
  const word = (item: Json, fallback: string) => item?.translations?.[lang] ?? fallback;
  return {
    ...(site.translations?.[lang]?.tagline ? { tagline: site.translations[lang].tagline } : {}),
    headerNavItems: (site.header ?? []).map((item: Json) => ({ label: word(item, item.label), href: item.href })),
    footerColumns: (site.footer?.columns ?? []).map((col: Json) => ({
      heading: word(col, col.heading),
      links: (col.links ?? []).map((link: Json) => ({ label: word(link, link.label), href: link.href })),
    })),
  };
}

/** Whether a site translates anything into `lang` (so the seeder only writes a language that has words). */
export function translatesSite(site: Json, lang: string): boolean {
  const any = (items: Json[] | undefined) => (items ?? []).some((i) => i?.translations?.[lang]);
  return Boolean(site.translations?.[lang]?.tagline) || any(site.header) || any(site.footer?.columns) || (site.footer?.columns ?? []).some((c: Json) => any(c.links));
}

/** A form's fields as the form builder stores them. */
export function formFields(fields: Json[]): Json[] {
  return fields.map((field) => {
    const base = { blockType: field.type, name: field.name, label: field.label, required: field.required === true };
    if (field.type === "select") return { ...base, options: (field.options ?? []).map((o: string) => ({ label: o, value: o })) };
    if (field.type === "message") return { blockType: "message", message: markupToLexical(field.message ?? field.label) };
    if (field.type === "checkbox") return { ...base, defaultValue: false };
    return base;
  });
}

export function formData(form: Json, siteId: number | string): Json {
  return {
    title: form.title,
    site: siteId,
    submitButtonLabel: form.submitButtonLabel ?? "Send",
    confirmationType: "message",
    confirmationMessage: markupToLexical(form.confirmationMessage ?? "Thank you. This is a demonstration form, so nothing was sent."),
    privacy: {
      purpose: form.purpose ?? "This is a demonstration site: whatever you type is not used for anything.",
      consentRequired: form.consentRequired ?? false,
      ...(form.consentLabel ? { consentLabel: form.consentLabel } : {}),
      ...(form.retentionDays ? { retentionDays: form.retentionDays } : {}),
    },
    fields: formFields(form.fields),
  };
}

/** Which form keys a showcase's blocks use, so a missing form is reported before anything is written. */
export function usedFormKeys(site: Json): string[] {
  const keys = new Set<string>();
  for (const page of site.pages ?? []) {
    for (const block of page.blocks ?? []) {
      if (FORM_BLOCKS.has(block.blockType) && typeof block.form === "string") keys.add(block.form);
    }
  }
  return [...keys];
}

/** Problems the schema cannot see: a block pointing at a form the file does not define, two pages with one address, and so on. */
export function crossChecks(site: Json): string[] {
  const problems: string[] = [];
  const formKeys = new Set((site.forms ?? []).map((f: Json) => f.key));
  (site.forms ?? []).forEach((f: Json, i: number, all: Json[]) => {
    if (all.findIndex((g) => g.key === f.key) !== i) problems.push(`forms[${i}].key: "${f.key}" is used twice`);
  });
  const seen = new Map<string, number>();
  (site.pages ?? []).forEach((page: Json, i: number) => {
    const slug = pageSlug(page.slug);
    if (seen.has(slug)) problems.push(`pages[${i}].slug: "${page.slug}" is the same address as pages[${seen.get(slug)}]`);
    seen.set(slug, i);
    (page.blocks ?? []).forEach((block: Json, j: number) => {
      if (FORM_BLOCKS.has(block.blockType) && !formKeys.has(block.form)) problems.push(`pages[${i}].blocks[${j}].form: no form with the key "${block.form}" in forms`);
    });
    for (const lang of Object.keys(page.translations ?? {})) {
      const t = page.translations[lang].blocks;
      if (Array.isArray(t) && t.length > (page.blocks ?? []).length) problems.push(`pages[${i}].translations.${lang}.blocks: has more items than the page has blocks`);
    }
  });
  if (!seen.has(HOME_SLUG)) problems.push(`pages: there is no front page (a page with the slug "home")`);
  const postSlugs = new Set<string>();
  (site.posts ?? []).forEach((post: Json, i: number) => {
    if (postSlugs.has(post.slug)) problems.push(`posts[${i}].slug: "${post.slug}" is used twice`);
    postSlugs.add(post.slug);
  });
  const languages: string[] = site.languages ?? [];
  const defaultLanguage = site.defaultLanguage ?? languages[0];
  if (site.defaultLanguage && languages.length > 0 && !languages.includes(site.defaultLanguage)) problems.push(`defaultLanguage: "${site.defaultLanguage}" is not one of languages`);
  const listed = (lang: string) => lang === defaultLanguage || languages.includes(lang);
  const check = (where: string, translations: Json) => {
    for (const lang of Object.keys(translations ?? {})) if (!listed(lang) || lang === defaultLanguage) problems.push(`${where}.${lang}: "${lang}" is not one of the extra languages in languages`);
  };
  check("translations", site.translations);
  (site.pages ?? []).forEach((p: Json, i: number) => check(`pages[${i}].translations`, p.translations));
  (site.posts ?? []).forEach((p: Json, i: number) => check(`posts[${i}].translations`, p.translations));
  return problems;
}

/** Where `actual` first differs from `desired` (the same comparison as `holds`), for the seeder's debug output. */
export function firstDifference(actual: Json, desired: Json, path = ""): string | undefined {
  if (holds(actual, desired)) return undefined;
  if (Array.isArray(desired) && Array.isArray(actual) && actual.length === desired.length) {
    for (let i = 0; i < desired.length; i++) {
      const found = firstDifference(actual[i], desired[i], `${path}[${i}]`);
      if (found) return found;
    }
  }
  if (isObject(desired) && isObject(actual)) {
    for (const [key, child] of Object.entries(desired)) {
      if (key === "id") continue;
      const found = firstDifference(actual[key], child, path ? `${path}.${key}` : key);
      if (found) return found;
    }
  }
  const short = (v: Json) => (JSON.stringify(v) ?? "undefined").slice(0, 80);
  return `${path || "(root)"}: has ${short(actual)}, wanted ${short(desired)}`;
}
