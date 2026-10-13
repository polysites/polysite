// The editorial rules for documents that have drafts (pages, posts), as plain functions so each one can be tested.
//
// A save is one of three things:
//   - a DRAFT SAVE ("Save draft"): the live version is untouched, so it needs nothing beyond permission to edit;
//   - a PUBLISH ("Publish changes", or any ordinary save that leaves the document published): the live version changes;
//   - an UNPUBLISH ("Unpublish"): the live version is taken down.
// Payload tells a draft save from the other two by `?draft=true` on the request. What the live version currently is
// has to be asked separately, because the document an editor opens may be a newer draft.

export type Capability = "publish" | "unpublish";
export type Status = "draft" | "published";

export interface Save {
  /** True for "Save draft": the request carried `draft=true`. */
  isDraftSave: boolean;
  /** The `_status` in the request, when it has one. */
  requestedStatus: Status | undefined;
  /** What the live version is right now; `undefined` when the document does not exist yet. */
  liveStatus: Status | undefined;
}

export const isDraftRequest = (query: unknown): boolean => {
  const value = (query as { draft?: unknown } | undefined)?.draft;
  return value === true || value === "true";
};

// The capability a save needs on top of "may edit", or null when it needs none.
export function capabilityNeeded({ isDraftSave, requestedStatus, liveStatus }: Save): Capability | null {
  if (isDraftSave) return null;
  const next: Status = requestedStatus ?? liveStatus ?? "draft";
  if (next === "published") return "publish";
  return liveStatus === "published" ? "unpublish" : null;
}

// Publishing finishes a review, so the review marker is cleared by it.
export const clearsReview = ({ isDraftSave, requestedStatus }: { isDraftSave: boolean; requestedStatus: Status | undefined }): boolean =>
  !isDraftSave && requestedStatus === "published";

// Whether the public site's cached pages must be refreshed after this save. Only the live version matters to visitors,
// so saving a draft never does.
export const changesLiveSite = ({ isDraftSave }: { isDraftSave: boolean }): boolean => !isDraftSave;

// When a page's address changes, the OLD live address needs a redirect. That is the slug of the live version before this
// save, never the slug of the previous draft (a draft may already carry the new one).
export function slugToRedirectFrom({
  isDraftSave,
  liveSlugBefore,
  slugAfter,
}: {
  isDraftSave: boolean;
  liveSlugBefore: string | undefined;
  slugAfter: string | undefined;
}): string | null {
  if (isDraftSave || !liveSlugBefore || !slugAfter) return null;
  return liveSlugBefore === slugAfter ? null : liveSlugBefore;
}
