// Finds the showcases in the themes folder, reads and validates each showcase/site.json, and reports every problem before the
// seeder writes anything. A showcase is a theme folder `polysite-theme-<name>/` that has `showcase/site.json`.
import fs from "node:fs";
import path from "node:path";

import { crossChecks, type Json } from "./content";
import { formatIssues, type Schema, validate } from "./jsonSchema";

export interface Showcase {
  /** The theme folder's name without the polysite-theme- prefix. */
  theme: string;
  /** The theme folder. */
  dir: string;
  /** `polysite-theme-salon/showcase/site.json`, for messages. */
  label: string;
  site: Json;
  /** The domain the site is served on: `<domainPrefix or slug>.<base domain>`. */
  domain: string;
}

export interface LoadResult {
  showcases: Showcase[];
  /** Problems that stop the seed, each naming the file and the path inside it. */
  errors: string[];
  /** Things worth saying that do not stop it. */
  warnings: string[];
}

/** An image over this many bytes is a warning: showcases ship small generated artwork. */
export const MAX_IMAGE_BYTES = 60 * 1024;

export const schemaPath = (themesDir: string): string => path.join(themesDir, "docs", "showcase.schema.json");

export function loadSchema(themesDir: string): Schema {
  return JSON.parse(fs.readFileSync(schemaPath(themesDir), "utf-8")) as Schema;
}

export interface LoadOptions {
  themesDir: string;
  baseDomain: string;
  /** Theme or showcase names to load; empty or absent means every showcase found. */
  only?: string[];
  /** The themes the CMS knows (the Sites theme list). A showcase whose theme is missing is an error. */
  installedThemes?: string[];
}

export function loadShowcases(options: LoadOptions): LoadResult {
  const { themesDir, baseDomain } = options;
  const only = (options.only ?? []).map((s) => s.trim()).filter(Boolean);
  const result: LoadResult = { showcases: [], errors: [], warnings: [] };

  let schema: Schema;
  try {
    schema = loadSchema(themesDir);
  } catch (err) {
    result.errors.push(`${schemaPath(themesDir)}: cannot read the showcase schema (${(err as Error).message})`);
    return result;
  }

  let entries: string[] = [];
  try {
    entries = fs.readdirSync(themesDir, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name.startsWith("polysite-theme-")).map((e) => e.name).sort();
  } catch {
    result.errors.push(`${themesDir}: the themes folder cannot be read`);
    return result;
  }

  const wanted = new Set(only);
  const found = new Set<string>();
  for (const folder of entries) {
    const theme = folder.slice("polysite-theme-".length);
    const dir = path.join(themesDir, folder);
    const file = path.join(dir, "showcase", "site.json");
    if (!fs.existsSync(file)) continue;
    const label = `${folder}/showcase/site.json`;

    let site: Json;
    try {
      site = JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch (err) {
      if (wanted.size === 0 || wanted.has(theme)) result.errors.push(`${label}: not valid JSON (${(err as Error).message})`);
      continue;
    }
    if (wanted.size > 0 && !wanted.has(theme) && !wanted.has(String(site?.slug))) continue;
    found.add(theme);
    if (typeof site?.slug === "string") found.add(site.slug);

    const before = result.errors.length;
    result.errors.push(...formatIssues(label, validate(schema, site)));
    if (result.errors.length > before) continue; // cross checks assume a valid shape

    result.errors.push(...crossChecks(site).map((problem) => `${label}: ${problem}`));
    if (site.theme !== theme) result.warnings.push(`${label}: theme is "${site.theme}" but the file is in polysite-theme-${theme}; the site will use "${site.theme}"`);
    if (options.installedThemes && !options.installedThemes.includes(site.theme)) {
      result.errors.push(`${label}: theme: "${site.theme}" is not an installed theme (installed: ${options.installedThemes.join(", ") || "none"}); restart the CMS after adding a theme folder`);
    }

    // The pictures the file refers to must exist, and stay small.
    const checked = new Set<string>();
    const check = (rel: unknown) => {
      if (typeof rel !== "string" || checked.has(rel)) return;
      checked.add(rel);
      const full = path.join(dir, "showcase", rel);
      if (!fs.existsSync(full)) result.errors.push(`${label}: ${rel}: the file does not exist (expected ${path.join(folder, "showcase", rel).replace(/\\/g, "/")})`);
      else if (fs.statSync(full).size > MAX_IMAGE_BYTES) result.warnings.push(`${label}: ${rel}: ${(fs.statSync(full).size / 1024).toFixed(0)} KB; showcase pictures should stay under 60 KB`);
    };
    const visit = (value: Json): void => {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
          if ((key === "image" || key === "photo") && typeof child === "string") check(child);
          else visit(child);
        }
      }
    };
    check(site.logo);
    check(site.favicon);
    visit(site.pages);
    visit(site.posts);

    result.showcases.push({ theme, dir, label, site, domain: `${site.domainPrefix ?? site.slug}.${baseDomain}` });
  }

  for (const name of wanted) {
    if (!found.has(name)) result.errors.push(`SHOWCASE_THEMES: no showcase named "${name}" (themes with a showcase/site.json: ${entries.filter((f) => fs.existsSync(path.join(themesDir, f, "showcase", "site.json"))).map((f) => f.slice(15)).join(", ") || "none"})`);
  }

  // Two showcases must not claim one domain or one slug.
  const domains = new Map<string, string>();
  const slugs = new Map<string, string>();
  for (const s of result.showcases) {
    if (domains.has(s.domain)) result.errors.push(`${s.label}: domain ${s.domain} is also used by ${domains.get(s.domain)}`);
    domains.set(s.domain, s.label);
    if (slugs.has(s.site.slug)) result.errors.push(`${s.label}: slug "${s.site.slug}" is also used by ${slugs.get(s.site.slug)}`);
    slugs.set(s.site.slug, s.label);
  }

  return result;
}
