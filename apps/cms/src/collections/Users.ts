import { APIError, type CollectionConfig } from "payload";

import { isSuperAdmin } from "../access/roles";
import { throttleAuthOperations } from "../auth/ipThrottle";
import { openSetupRefused } from "../setup/policy";
import { authCookies } from "../utils/productionChecks";

// `role` is a relationship to the dynamic `roles` collection (see
// Roles.ts/rbac/) -- what an account can do is data, not a hardcoded enum.
// `isSuperAdmin` is the one deliberately hardcoded exception: a bedrock
// escape hatch outside the dynamic system entirely (see access/roles.ts's
// isSuperAdmin for why). `assignedSites` (injected automatically by the
// multi-tenant plugin -- see payload.config.ts's multiTenantPlugin
// `tenantsArrayField` config, not defined as a field here) gates which
// sites' content an account can see or touch at all; Super Admins bypass
// tenant scoping entirely via `userHasAccessToAllTenants` in the plugin
// config, same as before.
export const Users: CollectionConfig = {
  slug: "users",
  // Payload locks an account after 5 wrong passwords for 10 minutes. The session cookie is HttpOnly and SameSite=Lax always, and Secure
  // when the admin is served over https (otherwise a downgraded plain-http request would carry it).
  auth: { cookies: authCookies() },
  admin: {
    useAsTitle: "email",
    group: "Administration",
  },
  access: {
    // `read` was previously omitted entirely -- Payload defaults an absent
    // access function to its own built-in `() => true` (confirmed in
    // Sites.ts's own comment on this exact default), which made the Users
    // collection fully publicly readable and, as a side effect, surfaced
    // "Users" in the Administration nav group for every logged-in account
    // regardless of role. The inline comment that used to be here claimed
    // "everyone can read their own record" as if that were already
    // enforced -- it wasn't; no self-read check existed at all.
    //
    // Only a Super Admin can list/browse Users (so only they see it in
    // nav); a non-admin can still fetch their OWN document by id (needed
    // for the account page) via the `id` check, which Payload only
    // populates for a single-document request -- the nav-visibility probe
    // and any `find` (list) call pass no `id`, so the self-check is false
    // there and only isSuperAdmin(user) can make this true. Compared as
    // `String(id) === String(user.id)`, not `===` directly -- Postgres IDs
    // come through as a number on `user.id` but a string in `id` here, and
    // a real test (logging in as a non-admin) hit exactly that mismatch:
    // this returned `false` for a user reading their OWN account, which
    // broke Payload's own admin root layout outright (a hard "Forbidden"
    // runtime error, not just a hidden nav item) since it depends on being
    // able to re-fetch the logged-in user's own document.
    read: ({ req: { user }, id }) => isSuperAdmin(user) || (!!id && !!user && String(id) === String(user.id)),
    create: ({ req: { user } }) => isSuperAdmin(user),
    update: ({ req: { user } }) => isSuperAdmin(user),
    delete: ({ req: { user } }) => isSuperAdmin(user),
    // Payload's default lets any signed-in user unlock any account, which undoes the lockout that slows password guessing.
    unlock: ({ req: { user } }) => isSuperAdmin(user),
  },
  hooks: {
    // A per-address limit on signing in and on password-reset emails (auth/ipThrottle.ts).
    beforeOperation: [throttleAuthOperations],
    // When POLYSITE_SETUP_TOKEN is set, the very first account may only be made
    // through the setup page (setup/runSetup.ts, which presents the token).
    // Payload's own first-register endpoint is open until a user exists, so
    // without this the token would guard one door of two.
    beforeValidate: [
      async ({ data, operation, req }) => {
        if (operation !== "create" || req.context?.polysiteSetup || (!process.env.POLYSITE_SETUP_TOKEN && !openSetupRefused())) return data;
        const { totalDocs } = await req.payload.count({ collection: "users", overrideAccess: true, req });
        if (totalDocs === 0) throw new APIError("Create the first account from the setup page.", 403);
        return data;
      },
    ],
  },
  fields: [
    {
      name: "role",
      type: "relationship",
      relationTo: "roles",
      hasMany: false,
      required: true,
    },
    {
      name: "isSuperAdmin",
      type: "checkbox",
      defaultValue: false,
      // Only an existing Super Admin can grant or revoke this -- prevents
      // an account from ever self-escalating by editing its own record.
      access: {
        update: ({ req: { user } }) => isSuperAdmin(user),
      },
      admin: {
        description: "The one hardcoded, non-role-based grant of full access. Not shown/used anywhere else in the RBAC system -- see access/roles.ts.",
      },
    },
  ],
};
