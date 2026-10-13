import type { CollectionConfig } from "payload";

import { isSuperAdmin } from "../access/roles";
import { RBAC_MODULES } from "../rbac/modules";
import { removeCachedRole, upsertCachedRole } from "../rbac/permissionCache";

// The dynamic half of RBAC: every role except the hardcoded isSuperAdmin
// escape hatch (see access/roles.ts) is a document here, editable by a
// Super Admin through this collection's own admin UI -- no code change, no
// restart, takes effect on the next request via the afterChange/afterDelete
// hooks below keeping rbac/permissionCache.ts's in-memory cache in sync.
//
// Deliberately only Super Admin can write here (never a "manage roles"
// capability drawn from this same collection) -- letting the dynamic system
// govern who can edit the dynamic system is the exact self-referential hole
// this design avoids: a bad or compromised role document could otherwise
// grant itself the power to edit roles.
export const Roles: CollectionConfig = {
  slug: "roles",
  admin: {
    useAsTitle: "name",
    group: "Administration",
    description:
      "Defines what each role can do. General operations (create/read/update/delete/publish/unpublish/clone-across-sites) apply uniformly to every module a role is given -- a future collection only needs adding to a role's Modules list, never a new permission definition.",
  },
  access: {
    // Was previously `Boolean(user)` (any authenticated user) on the
    // reasoning that hasCapability/canManageSiteSettings need to resolve a
    // user's own role -- but those both read from
    // rbac/permissionCache.ts's in-memory cache (populated via
    // `overrideAccess: true` lookups), never through this access-controlled
    // API path, so that justification didn't actually hold. The real,
    // visible effect: every non-admin account could list/read Roles, which
    // also surfaced "Roles" in the Administration nav group for every
    // logged-in user regardless of actual role.
    //
    // Gating this to isSuperAdmin-only (no exception) broke every other
    // role outright -- a hard 500 "Forbidden" on the admin root layout
    // itself, not just a hidden nav item. Payload populates a logged-in
    // user's own `role` relationship (Users.ts's `role` field) as part of
    // rendering the admin shell, which goes through this same
    // access-controlled read path, not an overrideAccess one. So a
    // non-admin still needs to read their OWN assigned role document by id
    // -- `id` is only present for a single-document fetch, never for a
    // `find` (list) or the nav-visibility probe, so this doesn't reopen
    // list/nav access for non-admins, only "can resolve my own role."
    read: ({ req: { user }, id }) => {
      if (isSuperAdmin(user)) return true;
      if (!user || !id) return false;
      const roleRef = (user as { role?: unknown }).role;
      const roleId = typeof roleRef === "object" && roleRef !== null ? (roleRef as { id: unknown }).id : roleRef;
      return String(id) === String(roleId);
    },
    create: ({ req: { user } }) => isSuperAdmin(user),
    update: ({ req: { user } }) => isSuperAdmin(user),
    delete: ({ req: { user } }) => isSuperAdmin(user),
  },
  hooks: {
    afterChange: [({ doc }) => upsertCachedRole(doc)],
    afterDelete: [({ id }) => removeCachedRole(id)],
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      unique: true,
    },
    {
      name: "isDefaultDeployed",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description:
          "Ships pre-seeded on a fresh install. Informational only -- never checked by any access-control logic; only a Users record's own isSuperAdmin flag grants real Super Admin power.",
      },
    },
    {
      name: "modules",
      // Plain text, not a Postgres enum: the list grows with the installed plugins (contentTypes.ts's modulesPlugin
      // fills the menu), and a plugin must not change a core table's type. See components/ModuleSelect.
      type: "text",
      hasMany: true,
      admin: {
        components: { Field: { path: "/components/ModuleSelect#ModuleSelect", clientProps: { options: RBAC_MODULES.map((m) => ({ label: m.label, value: m.value })) } } },
        description: "Which collections this role can touch at all. A module left out here is completely invisible to this role, regardless of the operations below.",
      },
    },
    {
      name: "operations",
      type: "group",
      admin: {
        description: "Applied uniformly across every module listed above.",
      },
      fields: [
        { name: "create", type: "checkbox", defaultValue: false },
        { name: "read", type: "checkbox", defaultValue: false },
        { name: "update", type: "checkbox", defaultValue: false },
        { name: "delete", type: "checkbox", defaultValue: false },
        { name: "publish", type: "checkbox", defaultValue: false },
        { name: "unpublish", type: "checkbox", defaultValue: false },
        { name: "cloneAcrossSites", type: "checkbox", defaultValue: false, label: "Clone/copy across sites" },
      ],
    },
    {
      name: "manageSiteSettings",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description: "Can edit this role's assigned Site(s)' own settings (branding, theme, domain, custom CSS/JS) -- the Sites collection itself, not the content inside it.",
      },
    },
  ],
};
