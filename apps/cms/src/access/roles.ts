import { getCachedRole } from "../rbac/permissionCache";
import type { CachedRole } from "../rbac/permissionCache";
import type { ClientUser } from "payload";

// Deliberately NOT the generated `User` type from payload-types.ts: these
// helpers are also called from admin.hidden callbacks (e.g. Sites.ts), which
// receive Payload's trimmed client-side `ClientUser`, not the full server
// `User` -- a structural, fields-only shape is what every real caller (and
// every test mock) actually satisfies. `ClientUser` is listed explicitly
// alongside it (rather than relying on its own `[key: string]: any` index
// signature) because TS's "weak type" check rejects an object with no
// explicitly-declared property in common with an all-optional interface --
// the index signature alone doesn't count.
export interface AuthUser {
  isSuperAdmin?: boolean | null;
  role?: number | string | { id: number | string } | null;
  assignedSites?: Array<{ site: number | string | { id: number | string } }> | null;
}

type MaybeUser = AuthUser | ClientUser | null | undefined;

// isSuperAdmin is the one deliberately hardcoded, non-dynamic check in this
// entire RBAC system -- a bedrock escape hatch, not a role. Every other
// permission (Site Admin, Site User, and whatever roles get created after
// today) is pure data in the `roles` collection, editable by a Super Admin
// through the admin UI with zero code change or restart. This flag has to
// stay outside that dynamic system: if it were itself governed by the same
// Roles-collection lookup, a corrupted or misconfigured role document could
// lock every admin out of the one collection (`roles` itself) that could fix
// it, or worse, be used to self-escalate. Same reasoning as WordPress
// Multisite's network Super Admin list (stored separately from per-site
// roles/capabilities) or AWS's root account sitting outside IAM policy
// evaluation entirely.
export const isSuperAdmin = (user: MaybeUser): boolean => user?.isSuperAdmin === true;

// `assignedSites` is the multi-tenant plugin's array field (each row shaped
// `{ site: <id or populated Site doc> }`), not a flat relationship array --
// unchanged by the RBAC redesign, orthogonal to which role a user holds.
export const userSiteIds = (user: MaybeUser): string[] =>
  (user?.assignedSites ?? []).map((row: { site: number | string | { id: number | string } }) =>
    String(typeof row?.site === "object" ? row.site.id : row?.site),
  );

function roleIdOf(user: MaybeUser): string | undefined {
  const role = user?.role;
  if (!role) return undefined;
  return typeof role === "object" ? String(role.id) : String(role);
}

function resolveRole(user: MaybeUser): CachedRole | undefined {
  return getCachedRole(roleIdOf(user));
}

export type RbacOperation =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "publish"
  | "unpublish"
  | "cloneAcrossSites";

// The one function every collection's access control calls. Super Admin
// bypasses the matrix entirely; anyone else needs their role to both list
// the module and have the operation turned on. A role that doesn't exist in
// the cache (deleted, or the cache hasn't loaded yet), a module the role
// hasn't been given, or an operation left unchecked all fall through to
// `false` -- default-deny, never default-open. This is a deliberate,
// hard-learned rule (a collection with an undefined access function used to
// default to Payload's own `() => true`, a real security gap once), so this
// function is written to fail closed at every branch rather than relying on
// a caller to handle `undefined` safely.
export const hasCapability = (user: MaybeUser, moduleSlug: string, operation: RbacOperation): boolean => {
  if (isSuperAdmin(user)) return true;
  const role = resolveRole(user);
  if (!role) return false;
  if (!role.modules.includes(moduleSlug)) return false;
  return role.operations[operation] === true;
};

// Whether this user can edit their own assigned Site(s)' own settings
// (branding/theme/domain/custom CSS-JS) -- distinct from touching content
// inside a site, and the one thing that separates Site Admin from Site User.
export const canManageSiteSettings = (user: MaybeUser): boolean => {
  if (isSuperAdmin(user)) return true;
  const role = resolveRole(user);
  return role?.manageSiteSettings === true;
};
