import { describe, expect, it } from "vitest";
import type { Config } from "payload";

import { RBAC_MODULES } from "../rbac/modules";
import { contentCollections, fromConfig, metaOf, modulesOf, modulesPlugin, routableOf, routableSlugs } from "./contentTypes";

const posts = {
  slug: "posts",
  fields: [],
  custom: { polysite: { module: { label: "Posts", value: "posts" }, routable: { docType: "post", urlPath: () => "news/x", previewUrl: () => "http://x/news/x", livePreview: false } } },
};
const categories = { slug: "post-categories", fields: [], custom: { polysite: { module: { label: "Posts", value: "posts" } } } };
const events = { slug: "events", fields: [], custom: { polysite: { module: { label: "Events", value: "events" }, routable: { docType: "event", urlPath: () => "e", previewUrl: () => "e", seo: false } } } };
const plain = { slug: "pages", fields: [] };

const config = (collections: unknown[]) => ({ collections }) as unknown as Config;

describe("reading what collections declare about themselves", () => {
  it("only recognises a declaration that names a module", () => {
    expect(metaOf(posts)?.module.value).toBe("posts");
    expect(metaOf(plain as never)).toBeUndefined();
    expect(metaOf({ custom: { polysite: {} } })).toBeUndefined();
    expect(metaOf(undefined)).toBeUndefined();
  });

  it("lists the declaring collections, and which of them are addressable", () => {
    const c = config([plain, posts, categories, events]);
    expect(contentCollections(c).map((x) => x.slug)).toEqual(["posts", "post-categories", "events"]);
    expect(routableSlugs(c)).toEqual(["posts", "events"]);
    expect(routableSlugs(c, "seo")).toEqual(["posts"]); // events opted out of SEO
    expect(routableSlugs(c, "livePreview")).toEqual(["events"]); // posts opted out of previews
    expect(routableOf(c, "posts")?.docType).toBe("post");
    expect(routableOf(c, "post-categories")).toBeUndefined();
    expect(routableOf(c, "missing")).toBeUndefined();
  });

  it("offers the core's modules plus each plugin module once, even when two collections share it", () => {
    const values = modulesOf(config([plain, posts, categories, events])).map((m) => m.value);
    expect(values).toEqual([...RBAC_MODULES.map((m) => m.value), "posts", "events"]);
    expect(modulesOf(config([plain])).map((m) => m.value)).toEqual(RBAC_MODULES.map((m) => m.value));
  });
});

// The menu is the field's admin component (components/ModuleSelect), not a database enum.
const menuOf = (field: Record<string, any>): Array<{ value: string }> => field.admin.components.Field.clientProps.options; // eslint-disable-line @typescript-eslint/no-explicit-any

describe("feeding plugin modules into the admin lists", () => {
  const roles = { slug: "roles", fields: [{ name: "modules", type: "text", hasMany: true }] };
  const sites = {
    slug: "sites",
    fields: [{ type: "tabs", tabs: [{ label: "General", fields: [{ name: "enabledModules", type: "text", hasMany: true, defaultValue: [] }] }] }],
  };

  it("adds them to Roles' modules and to Sites' enabled modules (options and default), wherever that field is nested", () => {
    const out = modulesPlugin(config([roles, sites, posts])) as unknown as { collections: Array<{ slug: string; fields: Array<Record<string, any>> }> }; // eslint-disable-line @typescript-eslint/no-explicit-any
    const values = ["pages", "media", "forms", "form-submissions", "privacy-requests", "redirects", "posts"];
    const rolesField = out.collections.find((c) => c.slug === "roles")!.fields[0];
    expect(menuOf(rolesField).map((o: { value: string }) => o.value)).toEqual(values);
    const enabled = out.collections.find((c) => c.slug === "sites")!.fields[0].tabs[0].fields[0];
    expect(menuOf(enabled).map((o: { value: string }) => o.value)).toEqual(values);
    expect(enabled.defaultValue).toEqual(values);
  });

  it("keeps a module whose plugin is gone, so saving a site or role doesn't reject or drop it", () => {
    const out = modulesPlugin(config([roles, sites, posts])) as unknown as { collections: Array<{ slug: string; fields: Array<Record<string, any>> }> }; // eslint-disable-line @typescript-eslint/no-explicit-any
    const validate = out.collections.find((c) => c.slug === "roles")!.fields[0].validate;
    expect(validate(["pages", "removed-plugin-module"])).toBe(true);
    expect(validate(undefined)).toBe(true);
    expect(validate("not-a-list")).not.toBe(true);
  });

  it("leaves everything else as it was", () => {
    const out = modulesPlugin(config([plain, posts])) as unknown as { collections: unknown[] };
    expect(out.collections).toEqual([plain, posts]);
  });
});

describe("fromConfig", () => {
  it("builds a plugin's options from the config as the earlier plugins left it", async () => {
    const seen: string[][] = [];
    const plugin = fromConfig((c) => {
      seen.push(contentCollections(c as never).map((x) => x.slug));
      return (cfg) => ({ ...cfg, custom: { ran: true } }) as never;
    });
    const out = (await plugin(config([posts, plain]))) as unknown as { custom: { ran: boolean } };
    expect(seen).toEqual([["posts"]]);
    expect(out.custom.ran).toBe(true);
  });
});
