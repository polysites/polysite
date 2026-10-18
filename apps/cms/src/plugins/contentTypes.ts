import type { CollectionConfig, Config, Field, Payload, PayloadRequest } from "payload";
import { trace } from "@opentelemetry/api";

import { canManageSiteSettings, hasCapability, isSuperAdmin, userSiteIds } from "../access/roles";
import { createSession } from "../auth/createSession";
import { localizeNamed } from "../i18n/localize";
import { reviewFields } from "../workflow/fields";
import { liveBefore, publishAware, publishRules } from "../workflow/hooks";
import { changesLiveSite, isDraftRequest, slugToRedirectFrom } from "../workflow/rules";
import { RBAC_MODULES, type RbacModuleOption } from "../rbac/modules";
import { normalizeSlug } from "../utils/slug";
import { uniquePerSite } from "../utils/uniquePerSite";

// A content-type plugin (a plugin whose manifest says `"kind": "content-type"`) adds collections whose items belong
// to one site, and often have a public web address. It says what each collection is by putting a declaration on the
// collection itself, in Payload's own `custom` slot:
//
//     { slug: "posts", ..., custom: { polysite: { module: { label: "Posts", value: "posts" }, routable: { ... } } } }
//
// and the core wires up the rest by reading the built config: the role module, per-site scoping, SEO fields, the URL
// index and Live Preview. That is the same idea as a Drupal entity type declaring its own handlers and links, and it
// needs no registry of its own: the config is the registry. See plugins/README.md.

export interface RoutableDeclaration {
  /** What the URL manager calls this kind of item, like "post". */
  docType: string;
  /** The item's address within its site, without a leading slash (like "news/budget-day"). */
  urlPath: (doc: Record<string, unknown>, ctx: { payload: Payload; site: Record<string, unknown> | null; locale?: string }) => string | Promise<string>;
  /** The full public URL, used by Live Preview. */
  previewUrl: (doc: Record<string, unknown>, req: PayloadRequest | undefined, locale?: string | null) => string | Promise<string>;
  /** Defaults to true. */
  seo?: boolean;
  /** Defaults to true. */
  livePreview?: boolean;
}

/** What a content-type plugin puts at `collection.custom.polysite`. */
export interface PolysiteCollectionMeta {
  /** The role module this collection's permissions are filed under. Collections of one type share a module. */
  module: RbacModuleOption;
  /** Present when the collection's items have a public web address. */
  routable?: RoutableDeclaration;
  /** SVG path data (24 x 24 grid, stroked) for the collection's admin sidebar icon. Without it the nav uses a generic one. */
  icon?: { paths: string[] };
}

export function metaOf(collection: { custom?: unknown } | undefined): PolysiteCollectionMeta | undefined {
  const meta = (collection?.custom as { polysite?: PolysiteCollectionMeta } | undefined)?.polysite;
  return meta?.module?.value ? meta : undefined;
}

/** The collections that declared themselves, with what they declared. */
export function contentCollections(config: { collections?: Array<{ slug: string; custom?: unknown }> }): Array<{ slug: string; meta: PolysiteCollectionMeta }> {
  return (config.collections ?? []).flatMap((c) => {
    const meta = metaOf(c);
    return meta ? [{ slug: c.slug, meta }] : [];
  });
}

/** The core's modules plus those the installed content-type plugins declared, without repeats. */
export function modulesOf(config: { collections?: Array<{ slug: string; custom?: unknown }> }): RbacModuleOption[] {
  const all: RbacModuleOption[] = RBAC_MODULES.map((m) => ({ label: m.label, value: m.value }));
  for (const { meta } of contentCollections(config)) if (!all.some((m) => m.value === meta.module.value)) all.push(meta.module);
  return all;
}

/** The routable declaration for a collection, if it has one. */
export function routableOf(config: { collections?: Array<{ slug: string; custom?: unknown }> }, slug: string): RoutableDeclaration | undefined {
  return contentCollections(config).find((c) => c.slug === slug)?.meta.routable;
}

export function routableSlugs(config: { collections?: Array<{ slug: string; custom?: unknown }> }, flag?: "seo" | "livePreview"): string[] {
  return contentCollections(config).flatMap((c) => (c.meta.routable && (!flag || c.meta.routable[flag] !== false) ? [c.slug] : []));
}

/**
 * Builds a plugin whose options depend on the collections the earlier plugins added. Plugins are plain functions of
 * the config, so this simply reads the config as it stands and then runs the real plugin with options computed from it.
 */
export function fromConfig(make: (config: Config) => (config: Config) => Config | Promise<Config>) {
  return async (config: Config): Promise<Config> => make(config)(config);
}

/**
 * What the core hands every plugin as `apply(config, kit)`. Plugins stay independent code (no imports from the
 * app); anything they need from the core arrives here. Existing plugins ignore it.
 */
export interface PluginKit {
  hasCapability: typeof hasCapability;
  isSuperAdmin: typeof isSuperAdmin;
  canManageSiteSettings: typeof canManageSiteSettings;
  userSiteIds: typeof userSiteIds;
  normalizeSlug: typeof normalizeSlug;
  uniquePerSite: typeof uniquePerSite;
  /** Signs a person in without a password (the same session, token and cookie a password sign-in makes). The caller must already have decided they may. */
  createSession: typeof createSession;
  /** Drafts, publishing and unpublishing: the same rules pages follow (apps/cms/src/workflow). */
  /** Makes the named fields translatable, the way the core does for its own (a required one stays required in the default language only). */
  i18n: { localizeNamed: typeof localizeNamed };
  workflow: {
    publishRules: typeof publishRules;
    publishAware: typeof publishAware;
    liveBefore: typeof liveBefore;
    reviewFields: typeof reviewFields;
    isDraftRequest: typeof isDraftRequest;
    changesLiveSite: typeof changesLiveSite;
    slugToRedirectFrom: typeof slugToRedirectFrom;
  };
  /** Records an error on the current trace when tracing is on; a no-op otherwise. */
  recordException: (err: unknown) => void;
}

export function buildKit(): PluginKit {
  return {
    hasCapability,
    isSuperAdmin,
    canManageSiteSettings,
    userSiteIds,
    normalizeSlug,
    uniquePerSite,
    createSession,
    i18n: { localizeNamed },
    workflow: { publishRules, publishAware, liveBefore, reviewFields, isDraftRequest, changesLiveSite, slugToRedirectFrom },
    recordException: (err) => trace.getActiveSpan()?.recordException(err as Error),
  };
}

// Rewrites the first field named `name` anywhere inside `fields` (through tabs, groups and the like).
function mapField(fields: Field[], name: string, change: (field: Field) => Field): Field[] {
  return fields.map((field) => {
    if ("name" in field && field.name === name) return change(field);
    if (field.type === "tabs") return { ...field, tabs: field.tabs.map((tab) => ({ ...tab, fields: mapField(tab.fields, name, change) })) } as Field;
    if ("fields" in field && Array.isArray(field.fields)) return { ...field, fields: mapField(field.fields as Field[], name, change) } as Field;
    return field;
  });
}

/**
 * Feeds the modules content-type plugins declared into the two admin lists that are built from the module list: the
 * Roles collection's `modules` options, and the Sites collection's `enabledModules` options and default (a new site
 * has every module on). Runs after the content-type plugins so their modules are known.
 *
 * A module whose plugin has been removed or deactivated may still be ticked on a site or a role. That is kept, not
 * rejected: the value stays in the database so reactivating the plugin finds everything as it was, and saving the
 * site or role in the meantime must not fail or silently untick it. So the field accepts any list of strings.
 */
export function modulesPlugin(config: Config): Config {
  const modules = modulesOf(config as { collections?: Array<{ slug: string; custom?: unknown }> });
  const options = modules.map((m) => ({ label: m.label, value: m.value }));
  const keepUnknown = (value: unknown) => value == null || (Array.isArray(value) && value.every((v) => typeof v === "string")) || "Modules must be a list.";
  // The menu is the field's admin component (components/ModuleSelect); the stored value is plain text, never a database enum.
  const withMenu = (f: Field): Field =>
    ({ ...f, validate: keepUnknown, admin: { ...(f as { admin?: object }).admin, components: { Field: { path: "/components/ModuleSelect#ModuleSelect", clientProps: { options } } } } }) as Field;
  const withModules = (collection: CollectionConfig, field: string, change: (f: Field) => Field): CollectionConfig => ({
    ...collection,
    fields: mapField(collection.fields, field, change),
  });
  return {
    ...config,
    collections: (config.collections ?? []).map((c) => {
      if (c.slug === "roles") return withModules(c, "modules", (f) => withMenu(f));
      if (c.slug === "sites") {
        return withModules(c, "enabledModules", (f) => ({ ...withMenu(f), defaultValue: modules.map((m) => m.value) }) as Field);
      }
      return c;
    }),
  };
}
