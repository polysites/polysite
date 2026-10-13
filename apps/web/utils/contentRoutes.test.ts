import { describe, expect, it } from "vitest";

import { createContentRegistry, resolveContent, type ContentRoute, type ContentRouteContext } from "./contentRoutes";

const nuxtApp = { runWithContext: <T>(fn: () => T) => fn() };
const ctx = (modules: string[] | undefined): ContentRouteContext => ({ nuxtApp, site: modules ? ({ enabledModules: modules } as never) : null });

const route = (over: Partial<ContentRoute> & { id: string }): ContentRoute => ({
  module: over.id,
  component: `${over.id}-view`,
  match: (slug) => (slug.startsWith(`${over.id}/`) ? { slug } : null),
  load: async (m) => ({ got: m }),
  ...over,
});

describe("the content route registry", () => {
  it("keeps routes in the order they were registered, and ignores a second registration of the same id", () => {
    const registry = createContentRegistry();
    registry.register(route({ id: "a" }));
    registry.register(route({ id: "b" }));
    registry.register(route({ id: "a", component: "other" }));
    expect(registry.all().map((r) => `${r.id}:${r.component}`)).toEqual(["a:a-view", "b:b-view"]);
  });
});

describe("resolveContent", () => {
  it("hands the address to the first route that owns it and has something to show", async () => {
    const routes = [route({ id: "posts" }), route({ id: "events" })];
    expect(await resolveContent(routes, "events/spring-fair", ctx(["posts", "events"]))).toEqual({ component: "events-view", props: { got: { slug: "events/spring-fair" } } });
  });

  it("returns null when no route owns the address, so the page lookup takes over", async () => {
    expect(await resolveContent([route({ id: "posts" })], "about-us", ctx(["posts"]))).toBeNull();
    expect(await resolveContent([], "anything", ctx(["posts"]))).toBeNull();
  });

  it("skips a route whose module is off for the site, without asking it", async () => {
    let asked = false;
    const routes = [route({ id: "posts", match: () => ((asked = true), {}) })];
    expect(await resolveContent(routes, "posts/x", ctx(["pages"]))).toBeNull();
    expect(await resolveContent(routes, "posts/x", ctx(undefined))).toBeNull();
    expect(asked).toBe(false);
  });

  it("lets a route that matches but finds nothing fall through to the next one", async () => {
    const routes = [route({ id: "posts", load: async () => null }), route({ id: "posts2", module: "posts", match: () => ({}), load: async () => ({ ok: true }) })];
    expect(await resolveContent(routes, "posts/gone", ctx(["posts"]))).toEqual({ component: "posts2-view", props: { ok: true } });
    expect(await resolveContent([routes[0]!], "posts/gone", ctx(["posts"]))).toBeNull();
  });
});
