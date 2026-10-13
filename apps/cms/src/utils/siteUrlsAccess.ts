import type { Access, Where } from "payload";

import { canManageSiteSettings, hasCapability, isSuperAdmin } from "../access/roles";

// Access to `site-urls`, the index of every address a site answers to (pages, plugins' public content, redirects). The
// visitor-facing parts of the app read it without signing in (the sitemap, the language links, site search), but an entry
// also exists for a page that has never been published, with its title and address. So:
//  - signed-in people who can read at least one of the indexed kinds of content see the whole index (the multi-tenant plugin
//    still limits them to their sites);
//  - everyone else, visitors included, sees only entries for live content ("published", or an "active" redirect).
// Changing or deleting an entry by hand is for site administrators (the admin's Reindex button needs it); the index is
// otherwise written by the server as content is saved.
const LIVE: Where = { status: { in: ["published", "active"] } };

/** `contentSlugs`: the collections the index covers, whose read permission opens the whole index. */
export const siteUrlsRead =
  (contentSlugs: string[]): Access =>
  ({ req: { user } }) => {
    if (user && (isSuperAdmin(user) || contentSlugs.some((slug) => hasCapability(user, slug, "read")))) return true;
    return LIVE;
  };

export const siteUrlsWrite: Access = ({ req: { user } }) => isSuperAdmin(user) || canManageSiteSettings(user);
