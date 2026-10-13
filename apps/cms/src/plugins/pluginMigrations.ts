import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { sql } from "@payloadcms/db-postgres";
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";

import type { DiscoveredPlugin } from "./discoverPlugins";

// A plugin owns its database tables, so it also owns the migrations that create them: plain ESM files in the plugin's
// own `migrations/` folder, named `<timestamp>_<name>.js`. They are written like this (scripts/pluginMigrations.sh
// generates them):
//
//     export async function up({ db, sql }) { await db.execute(sql`CREATE TABLE ...`) }
//     export async function down({ db, sql }) { ... }
//
// `sql` is handed in, because a plugin does not install the database driver. The core runs them with its own
// migrations through the database adapter's `prodMigrations` list, in the plugin's slug order, after the core's.
// Each is recorded under `<slug>__<file name>`, so two plugins can never collide and a plugin's history is its own.
//
// Removing a plugin removes its migrations from the list but never its tables: nothing here drops anything.

export interface PluginMigration {
  name: string;
  up: (args: MigrateUpArgs) => Promise<void>;
  down: (args: MigrateDownArgs) => Promise<void>;
}

interface MigrationModule {
  up?: (args: Record<string, unknown>) => Promise<void>;
  down?: (args: Record<string, unknown>) => Promise<void>;
}

// Hidden from the bundler for the same reason as the plugin entry (see discoverPlugins.ts).
const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<MigrationModule>;

export async function loadPluginMigrations(plugins: DiscoveredPlugin[]): Promise<PluginMigration[]> {
  const all: PluginMigration[] = [];
  for (const plugin of plugins) {
    const dir = path.join(plugin.dir, plugin.manifest.migrations ?? "migrations");
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js") || f.endsWith(".mjs")).sort();
    for (const file of files) {
      const mod = await dynamicImport(pathToFileURL(path.join(dir, file)).href);
      if (typeof mod.up !== "function") {
        console.error(`[plugins] ${plugin.manifest.slug}: migration ${file} has no up() -- skipped`);
        continue;
      }
      const { up, down } = mod;
      all.push({
        name: `${plugin.manifest.slug}__${file.replace(/\.m?js$/, "")}`,
        up: (args) => up({ ...args, sql }),
        down: async (args) => {
          if (typeof down === "function") await down({ ...args, sql });
        },
      });
    }
  }
  return all;
}
