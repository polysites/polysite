import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import type { Config } from "payload";

import type { PluginKit } from "./contentTypes";
import { checkRequires } from "./requires";

// Mirrors Sites.ts's discoverThemes() -- same WordPress-style convention
// (a directory under a sibling top-level folder, discovered at boot rather
// than hand-registered in this file), applied to plugins instead of
// themes. See plugins/README.md for the full contract a plugin directory
// has to satisfy.
export interface PluginManifest {
  slug: string;
  label: string;
  scope: "global" | "per-site";
  version: string;
  /**
   * "content-type": adds collections whose items belong to a site, each declaring itself in its
   * `custom.polysite` (see contentTypes.ts). Such plugins are applied before the core plugins, so the
   * scoping, SEO and index wiring can see their collections.
   */
  kind?: PluginKind | PluginKind[];
  /** Where the plugin's own migrations are, relative to the plugin folder. Defaults to `migrations`. */
  migrations?: string;
  /** The core versions this plugin works with, e.g. { "polysite": ">=0.1.0" } (see requires.ts). Optional. */
  requires?: { polysite?: string };
}

/**
 * "content-type": adds collections whose items belong to a site (contentTypes.ts).
 * "site-settings": keeps per-site settings in its own collection, declared in `custom.polysite.siteSettings` (siteSettings.ts).
 */
export type PluginKind = "content-type" | "site-settings";

const kindsOf = (manifest: PluginManifest): PluginKind[] => (manifest.kind === undefined ? [] : Array.isArray(manifest.kind) ? manifest.kind : [manifest.kind]);

/** Plugins of either kind add collections the core's own plugins must see (to scope them to a site), so they are applied first. */
export const isContentType = (plugin: { manifest: PluginManifest }): boolean => kindsOf(plugin.manifest).includes("content-type");

export const appliesEarly =(plugin: { manifest: PluginManifest }): boolean => kindsOf(plugin.manifest).length > 0;

export interface DiscoveredPlugin {
  manifest: PluginManifest;
  /** The plugin's folder. */
  dir: string;
  /** `kit` is what the core offers a plugin (helpers it can't import); plugins that don't need it ignore it. */
  apply: (config: Config, kit: PluginKit) => Config;
}

// Plain .js, not .ts -- a workspace-linked plugin resolves through
// node_modules, which Next.js doesn't transpile by default, so plugins
// ship code Node can already run natively (see plugins/README.md). This
// function itself runs inside apps/cms's own Next.js build, hence staying
// TypeScript.
export async function discoverPlugins(): Promise<DiscoveredPlugin[]> {
  const pluginsDir = path.resolve(process.cwd(), "../../plugins");
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
  } catch {
    // plugins/ not mounted into this container, or no plugins installed
    // yet -- an empty catalog, not an error (same fallback shape as
    // discoverThemes(), minus the "always return at least one option"
    // requirement, since an empty plugin list is a perfectly normal state
    // a dropdown-backing function like discoverThemes() doesn't have).
    return [];
  }

  // Deactivated plugins (POLYSITE_PLUGINS_OFF=posts,other): not loaded, nothing of theirs deleted. Their tables and
  // settings stay in the database, so turning one back on finds everything as it was.
  const off = new Set((process.env.POLYSITE_PLUGINS_OFF ?? "").split(",").map((s) => s.trim()).filter(Boolean));

  const onlyList = (process.env.POLYSITE_PLUGINS_ONLY ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const only = onlyList.length > 0 ? new Set(onlyList) : null;

  const discovered: DiscoveredPlugin[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pluginDir = path.join(pluginsDir, entry.name);
    const manifestPath = path.join(pluginDir, "polysite.plugin.json");
    if (!fs.existsSync(manifestPath)) continue; // not a plugin directory -- e.g. node_modules, .git

    let manifest: PluginManifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    } catch {
      console.error(`[plugins] ${entry.name}: polysite.plugin.json is unparsable -- skipped`);
      continue;
    }

    // POLYSITE_PLUGINS_ONLY=search,share loads just those ("none" loads none). Used to generate and check one plugin's
    // database changes on their own (scripts/pluginMigrations.sh); not for running a site.
    if (only && !only.has(manifest.slug) && !only.has(entry.name)) continue;

    // A plugin built for another core version is left out with a clear message, not loaded to fail later. Its data is kept.
    const unfit = checkRequires(manifest.requires?.polysite, process.env.POLYSITE_VERSION);
    if (unfit) {
      console.error(`[plugins] ${manifest.slug}: not loaded: ${unfit}. Nothing of its data is deleted.`);
      continue;
    }

    if (off.has(manifest.slug) || off.has(entry.name)) {
      console.log(`[plugins] ${manifest.slug}: deactivated (POLYSITE_PLUGINS_OFF) -- not loaded, its data is kept`);
      continue;
    }

    const entryPath = path.join(pluginDir, "src", "index.js");
    if (!fs.existsSync(entryPath)) {
      console.error(`[plugins] ${manifest.slug}: no src/index.js -- skipped`);
      continue;
    }

    // `await import(pathToFileURL(entryPath).href)` directly fails under
    // Turbopack (Next 16's dev bundler) with "Cannot find module as
    // expression is too dynamic" -- confirmed for real, not a guess:
    // Turbopack statically analyzes every import() specifier it can see at
    // build time and refuses one it can't resolve ahead of time, since a
    // plugin's path isn't known until this scan runs. Building the call
    // through `new Function` hides it inside a string the bundler never
    // parses as an import() expression at all, so it falls through to
    // Node's own runtime ESM loader unchanged -- the standard escape hatch
    // for genuinely dynamic, bundler-invisible imports in a Next.js app.
    const dynamicImport = new Function("specifier", "return import(specifier)") as (
      specifier: string,
    ) => Promise<{ default?: unknown }>;
    const mod = await dynamicImport(pathToFileURL(entryPath).href);
    if (typeof mod.default !== "function") {
      console.error(
        `[plugins] ${manifest.slug}: src/index.js's default export isn't a function -- skipped (does the plugin's package.json set "type": "module"? Without it Node loads src/index.js as CommonJS and ignores its \`export default\`.)`,
      );
      continue;
    }

    discovered.push({
      manifest,
      dir: pluginDir,
      apply: mod.default as (config: Config, kit: PluginKit) => Config,
    });
  }

  return discovered.sort((a, b) => a.manifest.slug.localeCompare(b.manifest.slug));
}
