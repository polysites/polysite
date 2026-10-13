// Local development and demonstration only: loads the showcase sites into an install. A showcase is a theme that ships a
// complete fictional demo website in `themes/polysite-theme-<name>/showcase/` (site.json + images); this script creates each
// as its own site, so one install can show off several very different websites at once. Full guide: docs/guide/showcase.md.
//
// Run inside the CMS container:  npx payload run scripts/seedShowcase.ts
// Settings (environment, all optional):
//   SHOWCASE_THEMES=salon,portfolio   only these (theme or showcase names); default: every theme with a showcase/site.json
//   SHOWCASE_BASE_DOMAIN=localhost    each site is <domainPrefix>.<this>
//   SEED_PASSWORD=...                 password of the accounts created by this run (otherwise a random one is printed)
//   SHOWCASE_URL_PORT=8180            only for the addresses it prints (when the proxy is not on port 80)
//   SHOWCASE_URLS_ONLY=1              print the addresses and stop
//
// Safe to run again: every record is looked up first, created when missing, updated when its content differs and left alone
// otherwise, and the run says which. It never changes or deletes an existing user, and creates a Super Admin only when the
// install has none. Anything that needs a plugin that is not installed (the posts, languages, search and share plugins, the
// blocks of the blocks-pack plugin) is skipped with a message, never a failure.
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { getPayload } from "payload";

import { THEMES } from "../src/collections/Sites";
import config from "../src/payload.config";
import {
  altFromPath,
  availableBlocks,
  collectImages,
  firstDifference,
  formData,
  holds,
  type Json,
  mapBlock,
  overlay,
  pageSlug,
  siteFields,
  siteTranslation,
  slugify,
  translatesSite,
  withIds,
} from "../src/showcase/content";
import { loadShowcases, type Showcase } from "../src/showcase/loadShowcases";
import { markupToLexical } from "../src/showcase/markup";

const DEFAULT_LOCALE = "en";
const SUPER_ADMIN_EMAIL = "showcase-admin@showcase.localhost";

const themesDir = path.resolve(process.cwd(), "../../themes");
const baseDomain = process.env.SHOWCASE_BASE_DOMAIN || "localhost";
const urlPort = process.env.SHOWCASE_URL_PORT && process.env.SHOWCASE_URL_PORT !== "80" ? `:${process.env.SHOWCASE_URL_PORT}` : "";
const only = (process.env.SHOWCASE_THEMES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const addressOf = (s: Showcase) => `http://${s.domain}${urlPort}`;

// Everything is checked before anything is written: a mistake in a site.json stops the run with every problem listed.
const loaded = loadShowcases({ themesDir, baseDomain, only, installedThemes: THEMES.map((t) => t.value) });
for (const warning of loaded.warnings) console.warn(`warning: ${warning}`);
if (loaded.errors.length > 0) {
  console.error(`\nThe showcase files have ${loaded.errors.length} problem${loaded.errors.length === 1 ? "" : "s"}; nothing was changed:\n`);
  for (const error of loaded.errors) console.error(`  ${error}`);
  process.exit(1);
}
if (loaded.showcases.length === 0) {
  console.log(`No showcase found: no theme under ${themesDir} has a showcase/site.json. Mount the themes repository as themes/ and restart the CMS.`);
  process.exit(0);
}
if (process.env.SHOWCASE_URLS_ONLY === "1") {
  for (const s of loaded.showcases) console.log(`${s.site.name.padEnd(28)} ${addressOf(s)}   (theme ${s.site.theme})`);
  process.exit(0);
}

// Top-level await keeps the process alive until the seed has finished (the payload CLI exits when the module's import resolves).
{
  const payload = await getPayload({ config });
  const has = (slug: string) => slug in payload.collections;
  const log = (message: string) => console.log(message);

  // What this install can store. Anything missing is skipped with a message.
  const pagesField = payload.collections.pages.config.fields.find((f) => "name" in f && f.name === "content") as Json;
  const installedBlocks = new Set<string>((pagesField?.blocks ?? []).map((b: Json) => (typeof b === "string" ? b : b.slug)));
  const abilities = {
    posts: has("posts") && has("post-categories"),
    newsSettings: has("news-settings"),
    languages: has("site-languages"),
    search: has("search-settings"),
    share: has("share-settings"),
  };

  const roles = await payload.find({ collection: "roles", limit: 0, overrideAccess: true });
  const roleId = (name: string): number | string => {
    const role = roles.docs.find((r) => r.name === name);
    if (!role) throw new Error(`Role "${name}" not found: has the CMS finished starting (it seeds the default roles on boot)?`);
    return role.id;
  };

  const password = process.env.SEED_PASSWORD || randomBytes(12).toString("base64url");
  const newAccounts: string[] = [];

  // One Super Admin, only on an install that has none.
  const superAdmins = await payload.count({ collection: "users", where: { isSuperAdmin: { equals: true } }, overrideAccess: true });
  if (superAdmins.totalDocs === 0) {
    await payload.create({ collection: "users", data: { email: SUPER_ADMIN_EMAIL, password, role: roleId("Super Admin"), isSuperAdmin: true } as never, overrideAccess: true });
    newAccounts.push(SUPER_ADMIN_EMAIL);
    log(`Created the Super Admin ${SUPER_ADMIN_EMAIL} (this install had none).`);
  } else {
    log(`The install already has a Super Admin; none created.`);
  }

  type Outcome = "created" | "updated" | "unchanged";
  const summary: string[] = [];

  /** Looks a record up, creates it when missing, updates it when `data` is not already there, and says which. */
  async function upsert(collection: string, where: Json, data: Json, options: { locale?: string; compare?: Json } = {}): Promise<{ doc: Json; outcome: Outcome }> {
    const found = await payload.find({ collection: collection as never, where, limit: 1, depth: 0, locale: options.locale as never, fallbackLocale: false as never, overrideAccess: true });
    const current = found.docs[0] as Json | undefined;
    if (!current) {
      const doc = (await payload.create({ collection: collection as never, data: data as never, locale: options.locale as never, overrideAccess: true })) as Json;
      return { doc, outcome: "created" };
    }
    if (holds(current, options.compare ?? data)) return { doc: current, outcome: "unchanged" };
    if (process.env.SHOWCASE_DEBUG) console.log(`    [debug] ${collection} ${JSON.stringify(where).slice(0, 80)} differs at ${firstDifference(current, options.compare ?? data)}`);
    // Rows (blocks, list items) keep their ids, so what other languages wrote on them survives the update.
    const doc = (await payload.update({ collection: collection as never, id: current.id, data: withIds(data, current) as never, locale: options.locale as never, overrideAccess: true })) as Json;
    return { doc, outcome: "updated" };
  }

  const tally = () => {
    const counts: Record<Outcome, number> = { created: 0, updated: 0, unchanged: 0 };
    return {
      add: (o: Outcome) => void counts[o]++,
      text: (noun: string) => `${counts.created + counts.updated + counts.unchanged} ${noun}${counts.created + counts.updated + counts.unchanged === 1 ? "" : "s"} (${counts.created} new, ${counts.updated} updated, ${counts.unchanged} unchanged)`,
      total: () => counts.created + counts.updated + counts.unchanged,
    };
  };

  async function seedOne(sc: Showcase): Promise<void> {
    const { site } = sc;
    const skipped: string[] = [];
    const say = (m: string) => log(`  [${site.slug}] ${m}`);
    log(`\n${site.name}  (${sc.domain}, theme ${site.theme})`);

    // Languages the site can actually offer here.
    let languages: string[] = [];
    let defaultLanguage = DEFAULT_LOCALE;
    if (site.languages?.length) {
      if (abilities.languages) {
        languages = site.languages;
        defaultLanguage = site.defaultLanguage ?? site.languages[0];
      } else {
        skipped.push(`languages ${site.languages.join(", ")} (the i18n plugin is not installed; the site stays in its default language)`);
      }
    }
    const locale = defaultLanguage;
    const extraLanguages = languages.filter((l) => l !== defaultLanguage);

    // 1. The site, without its pictures yet (they belong to the site and cannot exist before it).
    const noPictures = { mediaId: () => undefined as never };
    const baseFields = siteFields(site, sc.domain, noPictures);
    delete baseFields.logo;
    delete baseFields.favicon;
    const found = await payload.find({ collection: "sites", where: { domain: { equals: sc.domain } }, limit: 1, depth: 0, overrideAccess: true });
    let siteDoc: Json = found.docs[0];
    let siteOutcome: Outcome = "unchanged";
    if (!siteDoc) {
      siteDoc = await payload.create({ collection: "sites", data: baseFields as never, overrideAccess: true });
      siteOutcome = "created";
    }
    const siteId = siteDoc.id as number | string;

    // 2. Languages first: required text is only required in the site's default language, and that is read from this row.
    if (languages.length > 0) {
      const lang = await upsert("site-languages", { site: { equals: siteId } }, { site: siteId, languages, defaultLanguage });
      if (lang.outcome !== "unchanged") say(`languages ${languages.join(", ")} (default ${defaultLanguage}): ${lang.outcome}`);
    }

    // 3. Pictures: uploaded to this site's Media once each, named by their content so a changed picture is uploaded again.
    const mediaIds = new Map<string, number | string>();
    const media = tally();
    for (const use of collectImages(site)) {
      const file = path.join(sc.dir, "showcase", use.path);
      const bytes = fs.readFileSync(file);
      const ext = path.extname(file).toLowerCase();
      const stem = `${site.slug}-${path.basename(file, ext)}-${createHash("sha1").update(bytes).digest("hex").slice(0, 6)}`;
      const alt = use.alt ?? altFromPath(use.path);
      const known = await payload.find({
        collection: "media",
        where: { and: [{ site: { equals: siteId } }, { filename: { like: `${stem}.` } }] },
        limit: 1,
        depth: 0,
        locale: locale as never,
        fallbackLocale: false as never,
        overrideAccess: true,
      });
      let doc: Json = known.docs[0];
      if (!doc) {
        const mimetype = ext === ".svg" ? "image/svg+xml" : ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".gif" ? "image/gif" : "image/jpeg";
        doc = await payload.create({
          collection: "media",
          data: { alt, site: siteId } as never,
          file: { data: bytes, mimetype, name: `${stem}${ext}`, size: bytes.length },
          locale: locale as never,
          overrideAccess: true,
        });
        media.add("created");
      } else if (doc.alt !== alt) {
        doc = await payload.update({ collection: "media", id: doc.id, data: { alt } as never, locale: locale as never, overrideAccess: true });
        media.add("updated");
      } else {
        media.add("unchanged");
      }
      mediaIds.set(use.path, doc.id);
    }
    const mediaId = (p: string) => {
      const id = mediaIds.get(p);
      if (id === undefined) throw new Error(`${sc.label}: no media for ${p}`);
      return id;
    };

    // 4. The site's branding and menus, now with its logo; then the words of the other languages.
    const full = siteFields(site, sc.domain, { mediaId });
    const readSite = () => payload.findByID({ collection: "sites", id: siteId, depth: 0, locale: locale as never, fallbackLocale: false as never, overrideAccess: true }) as Promise<Json>;
    let settled = await readSite();
    if (!holds(settled, full)) {
      // Rows keep their ids, so the words other languages wrote on them survive the update.
      const keepRows = {
        ...full,
        headerNavItems: withIds(full.headerNavItems, settled.headerNavItems),
        footerColumns: withIds(full.footerColumns, settled.footerColumns),
        socialLinks: withIds(full.socialLinks, settled.socialLinks),
      };
      await payload.update({ collection: "sites", id: siteId, data: keepRows as never, locale: locale as never, overrideAccess: true });
      settled = await readSite();
      if (siteOutcome === "unchanged") siteOutcome = "updated";
    }
    for (const lang of extraLanguages) {
      if (!translatesSite(site, lang)) continue;
      const words = siteTranslation(site, lang);
      const current = (await payload.findByID({ collection: "sites", id: siteId, depth: 0, locale: lang as never, fallbackLocale: false as never, overrideAccess: true })) as Json;
      if (!holds(current, words)) {
        const withRows = { ...words, headerNavItems: withIds(words.headerNavItems, settled.headerNavItems), footerColumns: withIds(words.footerColumns, settled.footerColumns) };
        await payload.update({ collection: "sites", id: siteId, data: withRows as never, locale: lang as never, overrideAccess: true });
        if (siteOutcome === "unchanged") siteOutcome = "updated";
      }
    }
    if (site.footer?.copyright) skipped.push("footer.copyright (the sites collection has no such field yet; the theme prints its own line)");

    // 5. Forms.
    const formIds = new Map<string, number | string>();
    const forms = tally();
    for (const form of site.forms ?? []) {
      const data = formData(form, siteId);
      const result = await upsert("forms", { and: [{ title: { equals: form.title } }, { site: { equals: siteId } }] }, data);
      formIds.set(form.key, result.doc.id);
      forms.add(result.outcome);
    }
    const formId = (key: string) => {
      const id = formIds.get(key);
      if (id === undefined) throw new Error(`${sc.label}: no form with the key ${key}`);
      return id;
    };
    const ctx = { mediaId, formId };

    // 6. Pages.
    const pages = tally();
    const droppedBlocks: string[] = [];
    const contentOf = (rawBlocks: Json[]): Json[] => {
      const { kept, dropped } = availableBlocks(rawBlocks, installedBlocks);
      droppedBlocks.push(...dropped);
      return kept.map((b) => mapBlock(b, ctx));
    };
    for (const page of site.pages) {
      const slug = pageSlug(page.slug);
      const data: Json = {
        title: page.title,
        slug,
        site: siteId,
        _status: "published",
        content: contentOf(page.blocks),
        ...(page.description ? { meta: { description: page.description } } : {}),
      };
      const result = await upsert("pages", { and: [{ slug: { equals: slug } }, { site: { equals: siteId } }] }, data, { locale });
      pages.add(result.outcome);
      for (const lang of extraLanguages) {
        const t = page.translations?.[lang];
        if (!t) continue;
        const raw = overlay(page.blocks, t.blocks ?? []);
        const existing = (await payload.findByID({ collection: "pages", id: result.doc.id, depth: 0, locale: lang as never, fallbackLocale: false as never, overrideAccess: true })) as Json;
        const base = (await payload.findByID({ collection: "pages", id: result.doc.id, depth: 0, locale: locale as never, overrideAccess: true })) as Json;
        const translated: Json = {
          title: t.title ?? page.title,
          _status: "published",
          content: withIds(contentOf(raw), base.content),
          ...((t.description ?? page.description) ? { meta: { description: t.description ?? page.description } } : {}),
        };
        if (!holds(existing, translated)) await payload.update({ collection: "pages", id: result.doc.id, data: translated as never, locale: lang as never, overrideAccess: true });
      }
    }
    if (droppedBlocks.length > 0) {
      const counts = new Map<string, number>();
      for (const b of droppedBlocks) counts.set(b, (counts.get(b) ?? 0) + 1);
      skipped.push(`blocks ${[...counts].map(([b, n]) => `${b} x${n}`).join(", ")} (the blocks-pack plugin is not installed, or does not have them)`);
    }

    // 7. News: categories and posts (posts plugin).
    const posts = tally();
    if ((site.posts?.length ?? 0) > 0 || site.newsSettings) {
      if (!abilities.posts) {
        skipped.push(`${site.posts?.length ?? 0} posts (the posts plugin is not installed)`);
      } else {
        const modules: string[] = Array.isArray(settled.enabledModules) ? settled.enabledModules : [];
        if (!modules.includes("posts")) await payload.update({ collection: "sites", id: siteId, data: { enabledModules: [...modules, "posts"] } as never, overrideAccess: true });
        if (abilities.newsSettings) {
          await upsert("news-settings", { site: { equals: siteId } }, { site: siteId, ...(site.newsSettings ?? {}) });
        }
        const categoryIds = new Map<string, number | string>();
        for (const name of new Set<string>((site.posts ?? []).flatMap((p: Json) => p.categories ?? []))) {
          const category = await upsert("post-categories", { and: [{ slug: { equals: slugify(name) } }, { site: { equals: siteId } }] }, { name, slug: slugify(name), site: siteId }, { locale });
          categoryIds.set(name, category.doc.id);
        }
        for (const post of site.posts ?? []) {
          const data: Json = {
            site: siteId,
            title: post.title,
            slug: post.slug,
            _status: "published",
            publishedAt: new Date(post.date.length === 10 ? `${post.date}T09:00:00.000Z` : post.date).toISOString(),
            ...(post.byline ? { byline: post.byline } : {}),
            ...(post.excerpt ? { excerpt: post.excerpt } : {}),
            categories: (post.categories ?? []).map((c: string) => categoryIds.get(c)),
            ...(post.image ? { heroImage: mediaId(post.image) } : {}),
            body: markupToLexical(post.body),
          };
          const result = await upsert("posts", { and: [{ slug: { equals: post.slug } }, { site: { equals: siteId } }] }, data, { locale });
          posts.add(result.outcome);
          for (const lang of extraLanguages) {
            const t = post.translations?.[lang];
            if (!t) continue;
            const words: Json = {
              _status: "published",
              title: t.title ?? post.title,
              ...((t.excerpt ?? post.excerpt) ? { excerpt: t.excerpt ?? post.excerpt } : {}),
              ...((t.byline ?? post.byline) ? { byline: t.byline ?? post.byline } : {}),
              body: markupToLexical(t.body ?? post.body),
            };
            const existing = (await payload.findByID({ collection: "posts" as never, id: result.doc.id, depth: 0, locale: lang as never, fallbackLocale: false as never, overrideAccess: true })) as Json;
            if (!holds(existing, words)) await payload.update({ collection: "posts" as never, id: result.doc.id, data: words as never, locale: lang as never, overrideAccess: true });
          }
        }
      }
    }

    // 8. Plugin switches: search and share.
    const switches: string[] = [];
    if (site.search) {
      if (abilities.search) {
        const r = await upsert("search-settings", { site: { equals: siteId } }, { site: siteId, enabled: true });
        switches.push(`search ${r.outcome === "unchanged" ? "on" : `switched on (${r.outcome})`}`);
      } else skipped.push("search (the search plugin is not installed)");
    }
    if (site.share) {
      if (abilities.share) {
        const opts = typeof site.share === "object" ? site.share : {};
        const data: Json = { site: siteId, enabled: true, placement: "inline", ...(opts.networks ? { networks: opts.networks } : {}), ...(opts.style ? { style: opts.style } : {}), ...(opts.contentTypes ? { contentTypes: opts.contentTypes } : {}) };
        const r = await upsert("share-settings", { site: { equals: siteId } }, data);
        switches.push(`share buttons ${r.outcome === "unchanged" ? "on" : `switched on (${r.outcome})`}`);
      } else skipped.push("share buttons (the share plugin is not installed)");
    }

    // 9. Modules, if the file chooses them.
    if (Array.isArray(site.enabledModules)) {
      const wanted = new Set<string>([...site.enabledModules, "pages", "media"]);
      if (forms.total() > 0) wanted.add("forms");
      if (posts.total() > 0) wanted.add("posts");
      const now = ((await payload.findByID({ collection: "sites", id: siteId, depth: 0, overrideAccess: true })) as Json).enabledModules ?? [];
      if (JSON.stringify([...now].sort()) !== JSON.stringify([...wanted].sort())) {
        await payload.update({ collection: "sites", id: siteId, data: { enabledModules: [...wanted] } as never, overrideAccess: true });
        siteOutcome = siteOutcome === "created" ? "created" : "updated";
      }
    }

    // 10. A Site Admin for this site; an account that exists is left exactly as it is.
    const email = `${site.slug}-admin@showcase.localhost`;
    const existingUser = await payload.find({ collection: "users", where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true });
    let userText = `${email} (kept)`;
    if (!existingUser.docs[0]) {
      await payload.create({ collection: "users", data: { email, password, role: roleId("Site Admin"), assignedSites: [{ site: siteId }] } as never, overrideAccess: true });
      newAccounts.push(email);
      userText = `${email} (created)`;
    }

    say(`site ${siteOutcome}; ${pages.text("page")}; ${media.text("picture")}` + (forms.total() ? `; ${forms.text("form")}` : "") + (posts.total() ? `; ${posts.text("post")}` : "") + (switches.length ? `; ${switches.join(", ")}` : ""));
    say(`Site Admin ${userText}`);
    for (const s of skipped) say(`skipped: ${s}`);
    summary.push(`${site.name.padEnd(28)} ${addressOf(sc)}`);
  }

  for (const sc of loaded.showcases) {
    try {
      await seedOne(sc);
    } catch (err) {
      console.error(`\n[${sc.site.slug}] failed: ${(err as Error).message}`);
      console.error((err as { data?: unknown }).data ? JSON.stringify((err as { data: unknown }).data).slice(0, 1500) : "");
      process.exitCode = 1;
    }
  }

  log("\nThe showcase sites:");
  for (const line of summary) log(`  ${line}`);
  log(`  Admin: sign in with a Site Admin (<name>-admin@showcase.localhost) or the Super Admin; the admin address is in your .env (CMS_DOMAIN)`);
  if (newAccounts.length > 0) log(`\nThe accounts created now share one password: ${password}\n  ${newAccounts.join("\n  ")}\n(an account that already existed keeps its old password)`);
  process.exit(process.exitCode ?? 0);
}

