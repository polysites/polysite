// Local development only. Gives every installed plugin the chance to add its own fictional demo content to a site:
// a plugin that has `src/seed.js` exporting `seedDevData(payload, { site })` is called with the site and returns a
// line to print. The core knows nothing about what any plugin seeds.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { Payload } from "payload";

const pluginsDir = path.resolve(process.cwd(), "../../plugins");

export async function seedPluginDevData(payload: Payload, site: { id: number | string; domain?: string | null; enabledModules?: unknown }): Promise<void> {
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
  } catch {
    console.log("No plugins folder here; nothing to seed.");
    return;
  }
  for (const entry of entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const seedFile = path.join(pluginsDir, entry.name, "src", "seed.js");
    if (!fs.existsSync(seedFile)) continue;
    const mod = (await import(pathToFileURL(seedFile).href)) as { seedDevData?: (p: Payload, args: { site: typeof site }) => Promise<string | void> };
    if (typeof mod.seedDevData !== "function") continue;
    const message = await mod.seedDevData(payload, { site });
    console.log(`[${entry.name}] ${message ?? "seeded"}`);
  }
}
