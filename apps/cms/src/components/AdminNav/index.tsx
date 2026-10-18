import type { ServerProps } from "payload";
import { EntityType, groupNavItems } from "@payloadcms/ui/shared";
import type { EntityToGroup } from "@payloadcms/ui/shared";

import { isSuperAdmin } from "../../access/roles";
import { NavClient } from "./NavClient";

// Wired to admin.components.Nav (payload.config.ts) -- fully replaces
// Payload's DefaultNav, which also means beforeNav/afterNav/logout.Button
// stop rendering entirely (they only ever fired from inside DefaultNav
// itself, confirmed by reading @payloadcms/next's actual source). Their
// functionality lives directly in this tree instead: the site switcher is
// inlined into NavClient/SiteSwitcher.tsx (no more beforeNav-swap hack --
// see the deleted TenantSelectorGate.tsx), and logout is inlined into
// NavClient/AccountMenu.tsx (see the deleted LogoutButton.tsx).
//
// A Server Component (no "use client"), same pattern as the component this
// replaces (TenantSelectorGate.tsx) -- confirmed via RenderServerComponent's
// own branching (`isRSC ? serverProps : {}`) that only RSCs receive
// user/permissions/payload per request. This is what lets the capability
// checks below be real, not client-guessed.
export async function AdminNav(props: ServerProps) {
  const { payload, permissions, user, visibleEntities, i18n } = props;

  // Only undefined for a non-RSC render (see this file's top comment) --
  // shouldn't happen for this component in practice, but groupNavItems
  // requires it, so bail rather than pass through a value its own type
  // says can't be missing.
  if (!permissions) return null;

  // Real, permission-filtered grouping -- the exact same utility
  // (groupNavItems) and entities shape DefaultNav uses internally, driven by
  // each collection's own access.read (which already calls hasCapability),
  // not a second hand-rolled check that could drift from the real one.
  const { collections, globals } = payload.config;
  // Explicit annotation: without it, TS widens the spread-combined array to
  // a single object shape with unioned property types instead of keeping
  // the two mapped arrays' distinct discriminated-union shapes, which
  // groupNavItems' EntityToGroup[] parameter then rejects.
  const entities: EntityToGroup[] = [
    ...collections
      .filter(({ slug }) => visibleEntities?.collections?.includes(slug))
      .map((collection): EntityToGroup => ({ type: EntityType.collection, entity: collection })),
    ...globals
      .filter(({ slug }) => visibleEntities?.globals?.includes(slug))
      .map((global): EntityToGroup => ({ type: EntityType.global, entity: global })),
  ];
  const groups = groupNavItems(entities, permissions, i18n);

  const superAdmin = isSuperAdmin(user);

  // Cosmetic-only lookup (the account card's role label) -- real
  // enforcement never depends on this resolving; see access/roles.ts.
  let roleName = "";
  const roleRef = (user as { role?: unknown } | null | undefined)?.role;
  if (roleRef) {
    const roleId = typeof roleRef === "object" && roleRef !== null ? (roleRef as { id: unknown }).id : roleRef;
    try {
      const role = await payload.findByID({ collection: "roles", id: roleId as string, depth: 0, overrideAccess: true });
      roleName = typeof role?.name === "string" ? role.name : "";
    } catch {
      // role deleted out from under the user, or similar edge case -- blank
      // label is a fine fallback, not worth failing the whole nav render.
    }
  }

  // A collection or global can nest under a named sub-group inside its nav group
  // by setting `admin.custom.navSubgroup` (Payload itself only has one level).
  const subgroups: Record<string, string> = {};
  for (const entity of [...collections, ...globals]) {
    const label = (entity.admin?.custom as { navSubgroup?: unknown } | undefined)?.navSubgroup;
    if (typeof label === "string" && label) subgroups[entity.slug] = label;
  }

  // Icons a collection declares for itself (custom.polysite.icon, set by content-type plugins).
  const pluginIcons: Record<string, string[]> = {};
  for (const entity of collections) {
    const paths = (entity.custom as { polysite?: { icon?: { paths?: unknown } } } | undefined)?.polysite?.icon?.paths;
    if (Array.isArray(paths) && paths.every((p) => typeof p === "string")) pluginIcons[entity.slug] = paths as string[];
  }

  return (
    <NavClient
      groups={groups}
      subgroups={subgroups}
      pluginIcons={pluginIcons}
      isSuperAdmin={superAdmin}
      // A plugin can add another sign-in collection (the MCP plugin's API keys), so `user` is not always a staff account.
      userEmail={user && "email" in user && typeof user.email === "string" ? user.email : ""}
      roleName={roleName}
    />
  );
}
