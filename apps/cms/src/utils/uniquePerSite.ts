import type { CollectionSlug, Validate } from "payload";

// Shared by Pages.slug and Redirects.fromPath -- a value here is only
// meaningful scoped to a site ("about-us" on Site A and "about-us" on Site
// B are different things), but two documents on the SAME site both
// claiming it would make the frontend's site+value lookup
// (usePayloadPage) return an arbitrary one of them. Enforced here rather
// than a plain `unique: true` on the field, since that would make the
// value unique *globally* instead of per-site.
export function uniquePerSite(collectionSlug: string, fieldName: string): Validate {
  return async (value, { data, id, req, required }) => {
    // A custom `validate` replaces Payload's built-in required check, so it has to be repeated here: a blank value
    // let through would reach the database's NOT NULL and come back as a 500 "Something went wrong".
    if (!value) return required ? "This field is required." : true;
    if (!data?.site) return true;
    const siteId = typeof data.site === "object" ? data.site.id : data.site;

    const existing = await req.payload.find({
      collection: collectionSlug as CollectionSlug,
      where: {
        and: [
          { [fieldName]: { equals: value } },
          { site: { equals: siteId } },
          ...(id ? [{ id: { not_equals: id } }] : []),
        ],
      },
      limit: 1,
      overrideAccess: true,
      // Reuses the calling request's own transaction (Postgres adapter
      // keys it by req.transactionID) instead of opening a second one --
      // confirmed for real that skipping this can deadlock: a write
      // elsewhere in the same request (e.g. Pages.ts's auto-redirect hook
      // inserting a row with an FK back to the page still being saved) can
      // end up waiting on a lock only the OUTER, still-open transaction
      // holds, while that outer transaction is itself waiting on this call
      // to finish -- a real, reproduced ~65s-plus stall, not a theoretical one.
      req,
    });

    return existing.totalDocs === 0 || `Another document on this site already uses "${value}".`;
  };
}
