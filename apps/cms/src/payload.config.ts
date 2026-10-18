import { postgresAdapter } from "@payloadcms/db-postgres";
import { formBuilderPlugin } from "@payloadcms/plugin-form-builder";
import { multiTenantPlugin } from "@payloadcms/plugin-multi-tenant";
import { searchPlugin } from "@payloadcms/plugin-search";
import { seoPlugin } from "@payloadcms/plugin-seo";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import path from "path";
import { APIError, buildConfig, type Config } from "payload";
import sharp from "sharp";
import { fileURLToPath } from "url";

import { hasCapability, isSuperAdmin } from "./access/roles";
import { Users } from "./collections/Users";
import { Roles } from "./collections/Roles";
import { Sites } from "./collections/Sites";
import { Pages } from "./collections/Pages";
import { Media } from "./collections/Media";
import { Redirects } from "./collections/Redirects";
import { PrivacyRequests } from "./collections/PrivacyRequests";
import { loadPermissionCache } from "./rbac/permissionCache";
import { seedDefaultRoles } from "./rbac/seedRoles";
import { buildKit, contentCollections, fromConfig, modulesPlugin, routableOf, routableSlugs } from "./plugins/contentTypes";
import { appliesEarly, discoverPlugins, isContentType } from "./plugins/discoverPlugins";
import { loadPluginMigrations } from "./plugins/pluginMigrations";
import { siteSettingsCollections, siteSettingsPlugin } from "./plugins/siteSettings";
import { migrations as coreMigrations } from "./migrations";
import { pageUrlFromDoc } from "./utils/pageUrl";
import { formCountEndpoint, formDefinitionEndpoint, formSubmitEndpoint } from "./forms/endpoints";
import { formExportEndpoint } from "./forms/export";
import { hiddenFieldBlock } from "./forms/hiddenField";
import { privacyEraseEndpoint, privacyExportEndpoint, privacyFindEndpoint } from "./privacy/endpoints";
import { DEFAULT_LANGUAGE, payloadLocales } from "./i18n/catalog";
import { rememberPayload, skipsLanguage, translatedLanguages } from "./i18n/registry";
import { startJobRunner } from "./jobs/runner";
import { backfillVersions } from "./workflow/backfill";
import { startRetentionPurge } from "./privacy/retention";
import { MAX_SEARCH_TEXT } from "./search/extractText";
import { backfillSearchText, searchTextFor } from "./search/searchText";
import { setupEndpoint } from "./setup/endpoint";
import { assertProductionSafe } from "./utils/productionChecks";
import { siteUrlsRead, siteUrlsWrite } from "./utils/siteUrlsAccess";

// A server reachable over https must not run on the secrets .env.example ships with (utils/productionChecks.ts).
assertProductionSafe();

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

// Top-level await: this module only ever runs server-side at boot, same
// place discoverThemes() already does its own synchronous filesystem scan
// (Sites.ts) -- discovering plugins needs one async step first (dynamically
// importing each plugin's src/index.js), so the whole plugins array can't
// be built fully synchronously the way Sites.ts's THEMES constant is.
const discoveredPlugins = await discoverPlugins();

// A migration generated while a plugin is deactivated would drop that plugin's tables. Refuse rather than write it.
if (process.env.POLYSITE_PLUGINS_OFF?.trim() && process.argv.some((a) => a === "migrate:create")) {
  throw new Error("Don't generate a migration with POLYSITE_PLUGINS_OFF set: it would drop the deactivated plugins' tables. Unset it and run again.");
}
// Likewise with only some plugins loaded, unless it is a scratch run (scripts/pluginMigrations.sh sets POLYSITE_MIGRATION_DIR).
if (process.env.POLYSITE_PLUGINS_ONLY?.trim() && !process.env.POLYSITE_MIGRATION_DIR && process.argv.some((a) => a === "migrate:create")) {
  throw new Error("Don't generate a migration with POLYSITE_PLUGINS_ONLY set outside scripts/pluginMigrations.sh: it would drop the other plugins' tables.");
}

// Content-type plugins (manifest `"kind": "content-type"`, e.g. posts) add per-site collections. They are applied
// FIRST so the per-site scoping, SEO and URL-index wiring below can see their collections. Those wirings read what
// the collections declare about themselves (`custom.polysite`, see plugins/contentTypes.ts) from the config as it
// stands, rather than from names written into this file. The other plugins are applied last, as before.
// A plugin that keeps per-site settings in its own collection (`"kind": "site-settings"`, see plugins/siteSettings.ts)
// is applied first for the same reason: the multi-tenant plugin below must see that collection to scope it to a site.
// Content-type plugins go first, so a site-settings plugin (search, languages) sees the collections they add.
const contentPlugins = discoveredPlugins.filter(appliesEarly).sort((a, b) => Number(isContentType(b)) - Number(isContentType(a)));
const otherPlugins = discoveredPlugins.filter((p) => !appliesEarly(p));
const kit = buildKit();
const pluginMigrations = await loadPluginMigrations(discoveredPlugins);

export default buildConfig({
  // The admin's public origin, from the same CMS_SCHEME/CMS_DOMAIN Caddy
  // serves it on. Without it Payload can't trust any request's origin, falls
  // back to "", and builds the password-reset link in its email as a bare
  // "/admin/reset/<token>" with no host -- unclickable from an inbox (caught
  // before it shipped, while verifying the email plugin against real Gmail).
  // Unset CMS_DOMAIN keeps the old empty value rather than guessing a URL.
  serverURL: process.env.CMS_DOMAIN ? `${process.env.CMS_SCHEME || "http"}://${process.env.CMS_DOMAIN}` : "",
  // Payload sends anonymous usage reports to telemetry.payloadcms.com unless told not to (a capture of the running stack caught it).
  telemetry: false,
  admin: {
    user: Users.slug,
    // Payload's default shows each user's Gravatar, which sends a hash of every editor's email address to gravatar.com
    // whenever the account menu or the users list is drawn. The plain placeholder avatar keeps the admin from calling any other site.
    avatar: "default",
    importMap: {
      baseDir: path.resolve(dirname),
    },
    // Replaces Payload's default Nav (bare tenant <select>, flat unstyled
    // collections list, no branding, a disconnected avatar/logout pair)
    // with a real custom sidebar -- see components/AdminNav. Setting `Nav`
    // fully bypasses DefaultNav, which means beforeNav/afterNav/
    // logout.Button (all used by previous, now-deleted components --
    // TenantSelectorGate.tsx, LogoutButton.tsx) stop rendering entirely;
    // their functionality is folded directly into AdminNav/NavClient.tsx
    // instead (the site switcher, and the real logout link), not kept alive
    // through those now-dead config keys.
    //
    // `actions` renders in AppHeader's top-right (confirmed by reading
    // @payloadcms/next's getRouteData.js) -- the search popup and the
    // create-new picker live there, not in the sidebar, matching where the
    // approved mockup
    // put them.
    components: {
      Nav: "/components/AdminNav#AdminNav",
      // Replaces Payload's bare create-first-user screen with the setup page
      // (admin account + first site). Payload only routes here while no user exists.
      views: {
        createFirstUser: { Component: "/components/Setup/SetupView#SetupView" },
      },
      actions: ["/components/AdminActions/SearchAction#SearchAction", "/components/AdminActions/CreateAction#CreateAction"],
      graphics: {
        Logo: "/components/Brand/Logo#Logo",
        Icon: "/components/Brand/Mark#Mark",
      },
    },
    // See docs/BRAND.md -- the mark on a white rounded-square backdrop,
    // since a favicon has no surrounding element for the mark's own
    // currentColor stem to inherit from.
    meta: {
      icons: [{ url: "/brand/favicon.svg", type: "image/svg+xml" }],
    },
    // Pairs with the `content` blocks field on Pages: iframes the real Nuxt
    // page next to the editing form, updating live via postMessage as an
    // editor changes block fields. Satisfies the product requirements' "preview draft pages
    // across desktop, tablet, and mobile breakpoints" requirement without a
    // separate visual canvas.
    livePreview: {
      breakpoints: [
        { label: "Mobile", name: "mobile", width: 375, height: 667 },
        { label: "Tablet", name: "tablet", width: 768, height: 1024 },
        { label: "Desktop", name: "desktop", width: 1440, height: 900 },
      ],
      // Goes through Caddy (the site's own domain), not web
      // directly — web's port isn't published to the host, so
      // the admin's browser can only reach the site via the same route
      // any other visitor uses. Uses the page's own Site, so a second
      // site's page previews on its own host, not SITE_DOMAIN.
      // Live Preview only shows on the collections named here; without this no document gets the tab.
      collections: ["pages"],
      url: ({ data, req, collectionConfig }) => {
        const routable = (collectionConfig?.custom as { polysite?: { routable?: { previewUrl: (d: unknown, r: unknown) => string | Promise<string> } } } | undefined)?.polysite?.routable;
        return routable ? routable.previewUrl(data, req) : pageUrlFromDoc(data, req);
      },
    },
  },
  collections: [Users, Roles, Sites, Pages, Media, Redirects, PrivacyRequests],
  // POST /api/setup: backs the first-run page (components/Setup). Refuses once a
  // user exists.
  endpoints: [setupEndpoint, formDefinitionEndpoint, formSubmitEndpoint, formCountEndpoint, formExportEndpoint, privacyFindEndpoint, privacyExportEndpoint, privacyEraseEndpoint],
  // Seeds the 3 default roles (idempotent -- only creates what's missing)
  // and loads rbac/permissionCache.ts's in-memory matrix from the `roles`
  // collection, in that order, once at boot. Every hasCapability() check
  // reads from that cache, never the database directly, so a Super Admin
  // editing a role afterward takes effect via Roles.ts's own
  // afterChange/afterDelete hooks, not this boot-time load.
  onInit: async (payload) => {
    await seedDefaultRoles(payload);
    await loadPermissionCache(payload);
    // The search plugin's skipSync is not given a Payload instance; it asks which languages a site offers through this (and the site's `extensions.languages`).
    rememberPayload(payload);
    // Gives documents from before drafts existed their first version, so they show in the admin lists (workflow/backfill.ts).
    await backfillVersions(payload).catch((err) => payload.logger.error({ err, msg: "Could not write first versions for existing documents" }));
    // Deletes form submissions whose retention period has ended (privacy/retention.ts).
    startRetentionPurge(payload);
    // Scheduled publish and unpublish (jobs/runner.ts).
    startJobRunner(payload);
    // Index rows from before body text was searchable get their text, in the background (search/searchText.ts).
    void backfillSearchText(payload, payload.config.localization ? payload.config.localization.localeCodes : []).then(
      (n) => n > 0 && payload.logger.info(`Search index: added body text to ${n} entries.`),
      (err) => payload.logger.error({ err, msg: "Could not add body text to the search index" }),
    );
  },
  // Text is always stored in the translatable layout (one row per language), with English as the only language a fresh install
  // offers. The catalog of codes is fixed here so the database never needs a migration to add one; the i18n plugin adds the
  // per-site languages and widens this filter. Without it every admin sees, and can write, English only.
  localization: {
    locales: payloadLocales(),
    defaultLocale: DEFAULT_LANGUAGE,
    fallback: true,
    filterAvailableLocales: ({ locales }) => locales.filter((locale) => locale.code === DEFAULT_LANGUAGE),
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || "",
  // One upload (an image or a document) is capped, so a signed-in editor cannot fill the disk or tie up the image resizer with one request.
  // POLYSITE_MAX_UPLOAD_MB changes the cap (default 25).
  upload: { abortOnLimit: true, limits: { fileSize: (Number(process.env.POLYSITE_MAX_UPLOAD_MB) > 0 ? Number(process.env.POLYSITE_MAX_UPLOAD_MB) : 25) * 1024 * 1024 } },
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: postgresAdapter({
    // Local dev normally syncs tables to the config on every boot. POLYSITE_DB_PUSH=false stops that, so taking a
    // plugin away can never drop its tables (a database change then needs a migration).
    push: process.env.POLYSITE_DB_PUSH !== "false",
    // The core's migrations (core tables only), then each installed plugin's own (its tables only), run on start in
    // production. A scratch folder can stand in for the core's while one plugin's migration is generated.
    ...(process.env.POLYSITE_MIGRATION_DIR ? { migrationDir: process.env.POLYSITE_MIGRATION_DIR } : {}),
    prodMigrations: [...coreMigrations, ...pluginMigrations],
    pool: {
      connectionString: process.env.DATABASE_URL || "",
    },
  }),
  // Real build caught this: Media's imageSizes needs sharp passed explicitly
  // into buildConfig, not just installed as a dependency -- Payload logged
  // "Image resizing is enabled... but sharp not installed" until this was
  // added, exactly matching the pattern in the official create-payload-app
  // template inspected earlier in this project's history.
  sharp,
  plugins: [
    ...contentPlugins.map((p) => (config: Config) => p.apply(config, kit)),
    // The role and site-module lists include the installed content-type plugins' modules, and Live Preview is
    // switched on for their addressable collections.
    modulesPlugin,
    (config: Config): Config => ({
      ...config,
      admin: { ...config.admin, livePreview: { ...config.admin?.livePreview, collections: ["pages", ...routableSlugs(config, "livePreview")] as never } },
    }),
    formBuilderPlugin({
      // Adds a field the visitor never sees to the builder's list (forms/hiddenField.ts).
      fields: { hidden: hiddenFieldBlock },
      // The plugin's own default (no access restriction beyond Payload's
      // normal admin-auth requirement) needed overriding for both
      // collections it generates -- routed through the RBAC capability
      // matrix (rbac/seedRoles.ts) instead of a hardcoded role check, same
      // as every other collection. Form Submissions holds real
      // petition-signup PII, so it's locked down the same way, including read.
      formOverrides: {
        // The "Submissions" column and the box on a form's own screen (components below)
        // are how a form's submissions are reached; the collection itself is hidden from
        // the sidebar (formSubmissionOverrides).
        admin: { group: "Content", defaultColumns: ["title", "submissions", "createdAt"] },
        hooks: {
          // Submissions can't be deleted by hand, so a form that has some can't be deleted
          // either: that would leave them behind with no form. Retention and privacy
          // erasure remove them, after which the form can go.
          beforeDelete: [
            async ({ id, req }) => {
              const held = await req.payload.count({ collection: "form-submissions", where: { form: { equals: id } }, overrideAccess: true, req });
              if (held.totalDocs > 0) {
                throw new APIError(
                  `This form has ${held.totalDocs} submission${held.totalDocs === 1 ? "" : "s"}, which can't be deleted by hand. They are removed by the form's automatic deletion setting or a privacy request, and then the form can be deleted.`,
                  403,
                );
              }
            },
          ],
        },
        access: {
          create: ({ req: { user } }) => hasCapability(user, "forms", "create"),
          read: ({ req: { user } }) => hasCapability(user, "forms", "read"),
          update: ({ req: { user } }) => hasCapability(user, "forms", "update"),
          delete: ({ req: { user } }) => hasCapability(user, "forms", "delete"),
        },
        // Forms aren't multi-tenant-scoped (no `site` field of their own,
        // unlike Pages/Media) -- this is a smaller, explicit stand-in for
        // "which Page is this form on," not a full site-scoping fix. It
        // lets Redirects.toTarget point at a Form by resolving to the page
        // it's embedded on, and lets Redirects.toTarget's filterOptions
        // scope selectable forms to the right site via `landingPage.site`.
        // Deliberately separate from this plugin's own native
        // `confirmationType: 'redirect'` field, which means something
        // different (where to send the visitor AFTER submitting, often a
        // different page like a thank-you page).
        fields: ({ defaultFields }) => [
          {
            // Not stored: draws the submissions count in the forms list, and the summary
            // (counts, View submissions, Export) at the top of a form's own screen.
            name: "submissions",
            type: "ui",
            admin: {
              disableListFilter: true,
              components: {
                Field: "/components/FormSubmissionsSummary#FormSubmissionsSummary",
                Cell: "/components/FormSubmissionsCount#FormSubmissionsCount",
              },
            },
          },
          ...defaultFields,
          {
            // Extra protection against bots, on top of the checks every form already has (a hidden
            // trap field, a timing token and a rate limit). Checked on the server before anything is saved.
            name: "protection",
            type: "group",
            label: "Protection",
            fields: [
              {
                name: "captcha",
                type: "select",
                label: "Bot check",
                defaultValue: "none",
                options: [
                  { label: "None (the standard checks only)", value: "none" },
                  { label: "ALTCHA: built in, nothing for the visitor to do, no third party", value: "altcha" },
                  { label: "Cloudflare Turnstile: stronger, needs this site's Turnstile keys", value: "turnstile" },
                ],
                admin: {
                  description:
                    "ALTCHA makes the visitor's browser solve a small puzzle in the background. Turnstile is run by Cloudflare, so it shares a visitor's details with them: say so in your privacy policy, and add this site's keys under Sites, Forms tab. A form set to Turnstile without keys is not shown.",
                },
              },
            ],
          },
          {
            // For petitions: one signature per person, and a public count for a progress bar (forms/petition.ts).
            name: "petition",
            type: "group",
            label: "Petition",
            admin: { description: "Settings for a petition. Leave as they are for an ordinary form such as a contact form." },
            fields: [
              {
                name: "dedupe",
                type: "select",
                label: "One signature per person",
                defaultValue: "none",
                options: [
                  { label: "Off: every submission is kept (right for a contact form)", value: "none" },
                  { label: "By email address: the same address signing again is not stored or counted", value: "email" },
                ],
                admin: {
                  description:
                    "With this on, someone who signs twice with the same address sees the normal thank-you message but is only recorded once. Needs an email field on the form. What is kept is a one-way hash of the address, not a second copy.",
                },
              },
              {
                name: "showCount",
                type: "checkbox",
                label: "Show the signature count publicly",
                defaultValue: false,
                admin: { description: "Lets the site show how many people have signed (a number and, if you set one, a progress bar toward the goal)." },
              },
              {
                name: "countOffset",
                type: "number",
                label: "Starting number",
                min: 0,
                admin: {
                  description: "Added to the count: for signatures collected before this form, or elsewhere. Leave empty to count only what is stored here.",
                  condition: (_data, siblingData) => Boolean(siblingData?.showCount),
                },
              },
              {
                name: "goal",
                type: "number",
                label: "Goal",
                min: 1,
                admin: { description: "The number the progress bar fills toward. Leave empty for a plain count.", condition: (_data, siblingData) => Boolean(siblingData?.showCount) },
              },
            ],
          },
          {
            name: "landingPage",
            type: "relationship",
            relationTo: "pages",
            admin: {
              description:
                "Which page this form is embedded on. Set this if you want a redirect to be able to target this form.",
            },
          },
          {
            // What visitors are told when they give their details, and how long you keep them.
            name: "privacy",
            type: "group",
            admin: { description: "Tell people why you are collecting this and how long you will keep it." },
            fields: [
              {
                name: "purpose",
                type: "textarea",
                admin: {
                  description:
                    "Shown above the button. Say what you will use the information for and who sees it, in plain words. Example: \"We'll use your email to send campaign updates. We never share it.\"",
                },
              },
              {
                name: "consentRequired",
                type: "checkbox",
                defaultValue: false,
                admin: { description: "Add a checkbox people must tick before they can send the form." },
              },
              {
                name: "consentLabel",
                type: "text",
                admin: {
                  description: "Text next to the checkbox. Defaults to \"I agree to how my information is used.\"",
                  condition: (_data, siblingData) => Boolean(siblingData?.consentRequired),
                },
              },
              {
                name: "retentionDays",
                type: "number",
                min: 1,
                admin: {
                  description:
                    "Delete each submission this many days after it arrives. Leave empty to keep submissions until a privacy request removes them. Keep information only as long as you need it.",
                },
              },
            ],
          },
        ],
      },
      formSubmissionOverrides: {
        // One row per (form, person) when a form de-duplicates: the database refuses a second one, so two requests racing cannot both
        // be stored. Rows with no key (forms that do not de-duplicate) are never in conflict.
        indexes: [{ fields: ["form", "dedupeKey"], unique: true }],
        admin: {
          // Reached from each form (its Submissions column and summary), not from the sidebar.
          // `group: false` drops the sidebar and dashboard entries but keeps the pages; `hidden: true`
          // would remove the pages too, so the links from each form would 404.
          group: false,
          defaultColumns: ["form", "site", "createdAt", "submissionData"],
          components: { beforeList: ["/components/FormSubmissionsHeader#FormSubmissionsHeader"] },
        },
        fields: ({ defaultFields }) => [
          ...defaultFields.map((field) =>
            "name" in field && field.name === "form"
              ? ({ ...field, admin: { ...field.admin, components: { ...field.admin?.components, Cell: "/components/FormCell#FormCell" } } } as typeof field)
              : field,
          ),
          {
            // What the visitor was shown and whether they ticked the box, as it was at the time.
            name: "consent",
            type: "group",
            admin: { readOnly: true },
            fields: [
              { name: "given", type: "checkbox", admin: { description: "They ticked the consent box." } },
              { name: "statement", type: "textarea", admin: { description: "The wording they were shown." } },
              { name: "at", type: "date", admin: { date: { pickerAppearance: "dayAndTime" } } },
            ],
          },
          {
            // A keyed hash of the signer's email address (forms/petition.ts), set only on forms that ask for one signature per person.
            name: "dedupeKey",
            type: "text",
            admin: { hidden: true, readOnly: true },
          },
          {
            name: "expiresAt",
            type: "date",
            index: true,
            admin: { readOnly: true, description: "When this submission is deleted automatically (from the form's retention setting). Empty means it is kept." },
          },
        ],
        access: {
          // A submission is a record of what a person sent and agreed to, so nobody can
          // create, edit or delete one by hand, not even a Super Admin. They arrive through
          // /api/form-intake/:id (forms/endpoints.ts), which validates and scopes them, and
          // leave only through the form's automatic deletion or a privacy request (both
          // use the server's own access, not a person's). Reading is by role, as before.
          create: () => false,
          read: ({ req: { user } }) => hasCapability(user, "form-submissions", "read"),
          update: () => false,
          delete: () => false,
        },
      },
    }),
    fromConfig((config) => seoPlugin({
      collections: ["pages", ...routableSlugs(config, "seo")] as never,
      uploadsCollection: "media",
      // The plugin's own fields are not translatable by default; the search-result title and description are.
      fields: ({ defaultFields }) =>
        defaultFields.map((field) =>
          "name" in field && field.name === "meta" && "fields" in field
            ? { ...field, fields: field.fields.map((f) => ("name" in f && (f.name === "title" || f.name === "description") ? { ...f, localized: true } : f)) }
            : field,
        ) as typeof defaultFields,
      generateTitle: ({ doc }: { doc: Record<string, unknown> }) =>
        typeof doc?.title === "string" ? doc.title : "Polysite",
      // Without this the SEO tab's search-result preview shows a bare
      // "https://...".
      generateURL: ({ doc, req }) => pageUrlFromDoc(doc, req),
    })),
    // "Site URLs": a unified, read-only list of every route this app
    // responds to (every Page's slug, every Redirect's fromPath), so an
    // editor isn't stuck checking two separate collections to answer "what
    // URLs does this site actually have." Chosen over a hand-rolled custom
    // admin view specifically because the generated collection is a real
    // Payload collection -- groupNavItems (components/AdminNav/index.tsx)
    // picks it up in the sidebar automatically, same as any other
    // collection, with zero changes needed there. The plugin wires its own
    // afterChange/beforeDelete hooks onto `pages`/`redirects` to keep this
    // in sync. The Reindex button's picker UI gets its labels straight from
    // each target collection's own config, not a separate option here --
    // @payloadcms/plugin-search@3.90.2's SearchPluginConfig has no
    // `labels`/`collectionLabels` property at all (confirmed against its
    // shipped .d.ts; a `labels` block here previously typo'd past that and
    // was always a silent no-op, caught only once real type-checking ran).
    //
    // Pages and posts have native drafts (`versions.drafts`), and this index describes what is LIVE. So drafts sync (a page
    // that was never published still appears, marked as a draft), nothing is deleted when someone saves a draft over a live
    // page, and `beforeSync` below reads the live version rather than the draft that was just saved.
    fromConfig((config) => searchPlugin({
      collections: ["pages", ...routableSlugs(config), "redirects"] as never,
      defaultPriorities: { pages: 10, redirects: 5, ...Object.fromEntries(routableSlugs(config).map((slug) => [slug, 8])) },
      syncDrafts: true,
      deleteDrafts: false,
      // One index entry per language, but only for languages a site actually offers (its `extensions.languages` setting, read through
      // i18n/registry.ts); on its own the core indexes English only, instead of making one entry per catalog language.
      // The sync asks this just before `beforeSync` for the same language, in the same request, and `beforeSync` is not told the
      // language, so it is remembered here (a Reindex runs every language of a document in turn on one request).
      skipSync: ({ doc, locale, req }) => {
        (req.context as Record<string, unknown>).searchSyncLocale = locale ? String(locale) : undefined;
        return skipsLanguage(doc, locale ? String(locale) : undefined, req);
      },
      beforeSync: async ({ collectionSlug, originalDoc: saved, searchDoc, payload, req }) => {
        const syncLocale = (req.context as { searchSyncLocale?: string }).searchSyncLocale;
        // For a document with drafts, `saved` may be a draft saved over a live page; the index follows the live one.
        let originalDoc = saved;
        if ((payload.collections as unknown as Record<string, { config: { versions?: { drafts?: unknown } } } | undefined>)[collectionSlug]?.config.versions?.drafts && saved.id !== undefined) {
          const live = await payload.findByID({ collection: collectionSlug as never, id: saved.id, draft: false, depth: 0, overrideAccess: true, req, ...(syncLocale ? { locale: syncLocale as never } : {}) }).catch(() => null);
          if (live) originalDoc = live as typeof saved;
        }
        const routable = routableOf(payload.config, collectionSlug);
        let path: string = collectionSlug === "pages" ? originalDoc.slug : originalDoc.fromPath;
        if (routable) {
          // A content-type plugin says what its items' addresses are (they can depend on the site's settings).
          const ref = originalDoc.site;
          const siteId = ref && typeof ref === "object" ? ref.id : ref;
          const site = siteId ? await payload.findByID({ collection: "sites", id: siteId, depth: 0, overrideAccess: true }).catch(() => null) : null;
          path = await routable.urlPath(originalDoc, { payload, site: site as Record<string, unknown> | null });
        }
        // Which languages this document has text in, for the sitemap, the language switcher and hreflang. Read from the "all
        // languages" form of the live document; documents without a title (redirects) have none.
        let languages: string[] | null = null;
        if (collectionSlug !== "redirects" && originalDoc.id !== undefined) {
          const everything = await payload
            .findByID({ collection: collectionSlug as never, id: originalDoc.id, draft: false, locale: "all", depth: 0, overrideAccess: true, req })
            .catch(() => null);
          languages = everything ? translatedLanguages((everything as { title?: unknown }).title) : null;
        }
        return {
          ...searchDoc,
          languages,
          // The words of the live document, in this language, for visitor search (search/searchText.ts). Empty unless published.
          searchText: searchTextFor(payload, collectionSlug, originalDoc),
          title: originalDoc.title ?? searchDoc.title,
          site: originalDoc.site,
          path,
          docType: collectionSlug === "pages" ? "page" : routable ? routable.docType : "redirect",
          status: collectionSlug === "redirects" ? (originalDoc.enabled ? "active" : "disabled") : (originalDoc._status ?? originalDoc.status),
        };
      },
      searchOverrides: {
        slug: "site-urls",
        labels: { singular: "URL", plural: "Site URLs" },
        // Who can read the index, and who can change it by hand: utils/siteUrlsAccess.ts. create stays closed (the plugin's own default).
        access: { read: siteUrlsRead(["pages", "redirects", ...routableSlugs(config)]), update: siteUrlsWrite, delete: siteUrlsWrite },
        admin: {
          group: "URL Manager",
          useAsTitle: "path",
          defaultColumns: ["path", "docType", "status", "site"],
        },
        // `site` itself isn't declared here -- the multiTenantPlugin entry
        // below injects it onto "site-urls" the same way it does for every
        // other tenant-scoped collection, as long as that plugin runs AFTER
        // this one (plugins apply in array order); `beforeSync` above still
        // populates it like any other field on a create/update.
        fields: ({ defaultFields }) => [
          ...defaultFields,
          { name: "path", type: "text" },
          // Plain text, not a select: a select is a Postgres enum, and an installed content-type plugin would have to add its
          // type to this core table. The values are "page", "redirect" and what each routable collection declares.
          { name: "docType", type: "text", index: true },
          { name: "status", type: "text" },
          // The languages this page or post has text in (kept up to date by beforeSync above).
          { name: "languages", type: "json" },
          // The text of the live page or item in this language, as plain text (no markup, at most 50,000 characters), so visitor
          // search finds words in the body and not only in titles and addresses. Hidden: it is searched, never listed or shown in
          // the admin or returned by the API unless a caller asks for it. Filled when content is saved, by Reindex, and once at start.
          { name: "searchText", type: "textarea", localized: true, hidden: true, maxLength: MAX_SEARCH_TEXT },
        ],
      },
    })),
    // Replaces the hand-rolled site-scoping that used to live directly in
    // Pages.ts/Media.ts's access functions (a `userSiteIds`-based `Where`
    // filter, duplicated per collection) with Payload's own official
    // pattern: a tenant field auto-injected onto every collection listed
    // below, ANDed onto that collection's own access control automatically,
    // plus write-time enforcement rejecting any save that assigns a site the
    // user isn't a member of -- which the hand-rolled version never checked
    // on writes at all, only reads.
    //
    // `tenantsSlug`/`tenantField.name` deliberately keep the existing
    // `sites`/`site` naming instead of the plugin's own `tenants`/`tenant`
    // defaults: Sites.ts already exists with its own carefully-reasoned
    // access control and the frontend's `site.domain` queries
    // (usePayloadPage, useSite) needed zero changes this way -- only the
    // access-control internals changed, not the public data shape.
    fromConfig((config) => multiTenantPlugin({
      tenantsSlug: "sites",
      tenantField: { name: "site" },
      tenantsArrayField: {
        arrayFieldName: "assignedSites",
        arrayTenantFieldName: "site",
      },
      // Sites.ts's own access control (public read, admin-only write) stays
      // authoritative -- don't let the plugin layer its own default
      // tenant-collection access on top of a collection that already has a
      // deliberately-reasoned policy.
      useTenantsCollectionAccess: false,
      userHasAccessToAllTenants: (user) => isSuperAdmin(user),
      collections: {
        pages: {},
        media: {},
        redirects: {},
        "site-urls": {},
        // Forms and their submissions belong to one site each, so a site's editors
        // only see their own forms and the personal data they collect.
        forms: {},
        "form-submissions": {},
        "privacy-requests": {},
        // Collections of the installed content-type plugins (each belongs to one site).
        ...Object.fromEntries(contentCollections(config).map(({ slug }) => [slug, {}])),
        // A plugin's per-site settings: one row per site, opened straight from the admin (the multi-tenant plugin's own
        // "global per tenant" mode). The plugin's collection, the plugin's table; nothing is added to Sites.
        ...Object.fromEntries(siteSettingsCollections(config).map(({ slug }) => [slug, { isGlobal: true }])),
      } as never,
    })),
    // Installed from plugins/ (a separate, independently-versioned repo --
    // see plugins/README.md), discovered above rather than hand-imported
    // here: dropping a new plugin folder in and restarting the container is
    // the whole install step, no edit to this file. Applied last so a
    // plugin can see (and build on) everything the core config + the
    // plugins above it already set up.
    ...otherPlugins.map((p) => (config: Config) => p.apply(config, kit)),
    // Last: the config is complete, so every plugin's settings collection is visible. Adds the `extensions` read to
    // Sites and the cache refresh to each settings collection; no field, no table.
    siteSettingsPlugin,
  ],
});
