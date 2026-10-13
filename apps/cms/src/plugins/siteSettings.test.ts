import { describe, expect, it, vi } from "vitest";
import type { Config } from "payload";

import { pickPublic, siteSettingsCollections, siteSettingsOf, siteSettingsPlugin } from "./siteSettings";

const declared = { key: "search", publicFields: ["enabled", "perPage"] };
const settings = { slug: "search-settings", fields: [], custom: { polysite: { siteSettings: declared } } };
const sites = { slug: "sites", fields: [] };

describe("siteSettingsOf / siteSettingsCollections", () => {
  it("reads a declaration from custom.polysite", () => {
    expect(siteSettingsOf(settings)).toEqual(declared);
    expect(siteSettingsCollections({ collections: [sites, settings] })).toEqual([{ slug: "search-settings", declaration: declared }]);
  });

  it("ignores collections without a usable declaration", () => {
    expect(siteSettingsOf(undefined)).toBeUndefined();
    expect(siteSettingsOf({ custom: { polysite: { siteSettings: { key: "", publicFields: [] } } } })).toBeUndefined();
    expect(siteSettingsOf({ custom: { polysite: { siteSettings: { key: "x" } } } })).toBeUndefined();
    expect(siteSettingsCollections({ collections: [sites] })).toEqual([]);
  });
});

describe("pickPublic", () => {
  it("keeps only the listed fields that exist", () => {
    expect(pickPublic({ enabled: true, perPage: 5, secret: "s", id: 3 }, ["enabled", "perPage", "missing"])).toEqual({ enabled: true, perPage: 5 });
  });
});

describe("siteSettingsPlugin", () => {
  const config = { collections: [sites, settings] } as unknown as Config;

  it("changes nothing when no collection declares settings", () => {
    const plain = { collections: [sites] } as unknown as Config;
    expect(siteSettingsPlugin(plain)).toBe(plain);
  });

  it("adds no field to any collection", () => {
    const out = siteSettingsPlugin(config);
    for (const c of out.collections ?? []) expect(c.fields).toEqual([]);
  });

  it("attaches only the public fields of the site's row as site.extensions", async () => {
    const find = vi.fn().mockResolvedValue({ docs: [{ id: 9, site: 4, enabled: true, perPage: 3, secret: "nope" }] });
    const hook = siteSettingsPlugin(config).collections!.find((c) => c.slug === "sites")!.hooks!.afterRead![0];
    const out = (await hook({ doc: { id: 4, domain: "a.test" }, req: { payload: { find }, locale: "fr", fallbackLocale: "en" } } as never)) as Record<string, unknown>;
    expect(out.extensions).toEqual({ search: { enabled: true, perPage: 3 } });
    expect(out.domain).toBe("a.test");
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ collection: "search-settings", where: { site: { equals: 4 } }, locale: "fr", overrideAccess: true }));
  });

  it("leaves the key out when the site has no row, and survives a failing read", async () => {
    const empty = vi.fn().mockResolvedValue({ docs: [] });
    const hook = siteSettingsPlugin(config).collections!.find((c) => c.slug === "sites")!.hooks!.afterRead![0];
    expect(((await hook({ doc: { id: 1 }, req: { payload: { find: empty } } } as never)) as { extensions: object }).extensions).toEqual({});
    const broken = vi.fn().mockRejectedValue(new Error("db down"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(((await hook({ doc: { id: 1 }, req: { payload: { find: broken } } } as never)) as { extensions: object }).extensions).toEqual({});
    quiet.mockRestore();
  });

  it("refreshes the public site when a settings row changes or goes", () => {
    const out = siteSettingsPlugin(config).collections!.find((c) => c.slug === "search-settings")!;
    expect(out.hooks?.afterChange?.length).toBe(1);
    expect(out.hooks?.afterDelete?.length).toBe(1);
  });
});
