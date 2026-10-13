import type { PayloadSite } from "../types/payload";

// How a content-type plugin's web part (a Nuxt layer in plugins/<name>/web) puts its own addresses on a site.
// The plugin registers a route; the catch-all page (pages/[...slug].vue) asks each registered route, in turn,
// whether it owns the request, loads what it needs, and draws it with the plugin's component. Nothing here is
// specific to any one content type.

export interface ContentRouteContext {
  /** The Nuxt app of this request. Composables called after an `await` must go through `nuxtApp.runWithContext`. */
  nuxtApp: { runWithContext: <T>(fn: () => T) => T };
  site: PayloadSite | null | undefined;
}

export interface ContentRoute {
  /** Unique, like "posts". */
  id: string;
  /** The site module that must be on (Sites -> Enabled Modules) for this route to apply. */
  module: string;
  /** Cheap, synchronous check of the request path ("news/some-post", no slashes at the ends). Return what `load` needs, or null. */
  match: (slug: string, ctx: ContentRouteContext) => unknown | null;
  /** Loads what the page needs. Null means "nothing here after all", so the page lookup (and redirects) get their turn. */
  load: (match: unknown, ctx: ContentRouteContext) => Promise<Record<string, unknown> | null>;
  /** A global component, supplied by the plugin's layer, that draws the loaded props. */
  component: string;
}

export interface ContentRegistry {
  register: (route: ContentRoute) => void;
  all: () => ContentRoute[];
}

export function createContentRegistry(): ContentRegistry {
  const routes: ContentRoute[] = [];
  return {
    register(route) {
      if (!routes.some((r) => r.id === route.id)) routes.push(route);
    },
    all: () => routes,
  };
}

export interface ResolvedContent {
  component: string;
  props: Record<string, unknown>;
}

/**
 * The first registered route that owns the address and has something to show, or null. A route whose module is
 * off for the site is skipped without being asked. A route that matches but loads nothing doesn't end the search.
 */
export async function resolveContent(routes: ContentRoute[], slug: string, ctx: ContentRouteContext): Promise<ResolvedContent | null> {
  const enabled = ctx.site?.enabledModules ?? [];
  for (const route of routes) {
    if (!enabled.includes(route.module)) continue;
    const match = route.match(slug, ctx);
    if (match === null || match === undefined) continue;
    const props = await route.load(match, ctx);
    if (props) return { component: route.component, props };
  }
  return null;
}
