import type { Access, CollectionConfig } from "payload";

import { hasCapability } from "../access/roles";
import { relativizeUploadUrls } from "../utils/relativeMediaUrls";

// Same pattern as Pages.ts: which sites a non-admin can reach is the
// multi-tenant plugin's job now (payload.config.ts, `useTenantAccess: true`
// default on this collection); these check the RBAC capability matrix.
// Caught for real, before either existed: this collection once had no
// create/update/delete access function at all (only `read` was defined),
// which defaults to Payload's built-in `() => true` -- any authenticated
// user, of any role, on any site, could upload or delete any site's media.
const createAccess: Access = ({ req: { user } }) => hasCapability(user, "media", "create");
const updateAccess: Access = ({ req: { user } }) => hasCapability(user, "media", "update");
const deleteAccess: Access = ({ req: { user } }) => hasCapability(user, "media", "delete");

// Local disk storage (via Payload's default `upload.staticDir`), not a
// cloud storage plugin — matches the decision to keep
// uploads on the VM's own disk rather than pay for a managed object store.
// `sharp` (already a dependency of `payload` core) handles the resizing and
// WebP conversion below, satisfying the product requirements' "on-upload image
// optimization" requirement without any additional service.
export const Media: CollectionConfig = {
  slug: "media",
  admin: {
    group: "Content",
  },
  access: {
    read: () => true, // images must load on the public site unauthenticated
    create: createAccess,
    update: updateAccess,
    delete: deleteAccess,
  },
  hooks: {
    afterRead: [({ doc }) => relativizeUploadUrls(doc)],
  },
  upload: {
    staticDir: "media",
    imageSizes: [
      { name: "thumbnail", width: 400 },
      { name: "card", width: 800 },
    ],
    formatOptions: { format: "webp", options: { quality: 80 } },
  },
  fields: [
    // `site` is injected automatically by the multi-tenant plugin (see
    // payload.config.ts) -- not defined here.
    {
      name: "alt",
      type: "text",
      localized: true,
      required: true,
      admin: { description: "Required for accessibility (screen readers, AODA compliance)." },
    },
  ],
};
