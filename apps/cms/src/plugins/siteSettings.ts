import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, CollectionAfterReadHook, CollectionConfig, Config } from "payload";
import { trace } from "@opentelemetry/api";

// Per-site settings for a plugin, kept in the plugin's OWN collection instead of as fields on Sites (which would add
// columns to a core table). A plugin declares the collection on itself, in Payload's `custom` slot:
//
//     { slug: "search-settings", ..., custom: { polysite: { siteSettings: { key: "search", publicFields: ["enabled", "perPage"] } } } }
//
// and the core does the rest:
//  - one row per site (the multi-tenant plugin's `isGlobal` mode: the admin opens the current site's row directly);
//  - the row's `publicFields` are attached to every site the API returns, as `site.extensions.<key>`, so the public
//    site reads them with the request it already makes. Nothing else in the row ever leaves the admin, so a secret
//    in a settings row cannot reach the public site by accident;
//  - a change to the row refreshes the public site's cache, as a change to the site itself does.
//
// The core knows no plugin by name: the config is the registry, as for content-type plugins (contentTypes.ts).

export interface SiteSettingsDeclaration {
  /** The key under `site.extensions` the public fields appear at. */
  key: string;
  /** The top-level fields of the row that reach the public site. Anything not listed stays in the admin. */
  publicFields: string[];
}

export interface SiteSettingsCollection {
  slug: string;
  declaration: SiteSettingsDeclaration;
}

export function siteSettingsOf(collection: { custom?: unknown } | undefined): SiteSettingsDeclaration | undefined {
  const declared = (collection?.custom as { polysite?: { siteSettings?: SiteSettingsDeclaration } } | undefined)?.polysite?.siteSettings;
  return declared && typeof declared.key === "string" && declared.key && Array.isArray(declared.publicFields) ? declared : undefined;
}

export function siteSettingsCollections(config: { collections?: Array<{ slug: string; custom?: unknown }> }): SiteSettingsCollection[] {
  return (config.collections ?? []).flatMap((c) => {
    const declaration = siteSettingsOf(c);
    return declaration ? [{ slug: c.slug, declaration }] : [];
  });
}

/** Keeps only the listed fields. */
export function pickPublic(row: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of fields) if (row[name] !== undefined) out[name] = row[name];
  return out;
}

// The public site keeps what it rendered until something is published, so a change of settings would otherwise wait for
// the next page edit. The same call the pages make (collections/Pages.ts); a failure is not worth failing a save over.
async function refreshPublicSite(): Promise<void> {
  const url = process.env.NUXT_REVALIDATE_URL;
  if (!url) return;
  try {
    await fetch(url, { method: "POST", headers: { "x-revalidate-secret": process.env.REVALIDATE_SECRET || "" } });
  } catch (err) {
    console.error("Failed to trigger frontend revalidation", err);
    trace.getActiveSpan()?.recordException(err as Error);
  }
}

/**
 * Applied after every other plugin (the config is complete by then). Adds the `extensions` read to Sites and the cache
 * refresh to each settings collection. Adds no field and no table.
 */
export function siteSettingsPlugin(config: Config): Config {
  const declared = siteSettingsCollections(config as never);
  if (declared.length === 0) return config;

  const attach: CollectionAfterReadHook = async ({ doc, req }) => {
    if (!doc || typeof doc !== "object" || doc.id == null) return doc;
    const extensions: Record<string, unknown> = {};
    for (const { slug, declaration } of declared) {
      try {
        const found = await req.payload.find({
          collection: slug as never,
          where: { site: { equals: doc.id } },
          limit: 1,
          depth: 0,
          pagination: false,
          overrideAccess: true,
          locale: req.locale ?? undefined,
          fallbackLocale: (req.fallbackLocale as never) ?? undefined,
          req,
        });
        const row = found.docs[0] as Record<string, unknown> | undefined;
        // No row means "never set up": the plugin treats a missing key as its defaults.
        if (row) extensions[declaration.key] = pickPublic(row, declaration.publicFields);
      } catch (err) {
        // A settings row that cannot be read must never take the site down with it.
        console.error(`[site-settings] ${slug}: could not read the settings for site ${doc.id}:`, err instanceof Error ? err.message : err);
      }
    }
    return { ...doc, extensions };
  };

  const refresh: CollectionAfterChangeHook & CollectionAfterDeleteHook = async () => {
    await refreshPublicSite();
  };

  const settingsSlugs = new Set(declared.map((d) => d.slug));
  const collections = (config.collections ?? []).map((collection: CollectionConfig) => {
    if (collection.slug === "sites") {
      return { ...collection, hooks: { ...collection.hooks, afterRead: [...(collection.hooks?.afterRead ?? []), attach] } };
    }
    if (settingsSlugs.has(collection.slug)) {
      return {
        ...collection,
        hooks: {
          ...collection.hooks,
          afterChange: [...(collection.hooks?.afterChange ?? []), refresh],
          afterDelete: [...(collection.hooks?.afterDelete ?? []), refresh],
        },
      };
    }
    return collection;
  });
  return { ...config, collections };
}
