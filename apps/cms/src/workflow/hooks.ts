import type { Access, CollectionBeforeChangeHook, PayloadRequest } from "payload";

import { hasCapability } from "../access/roles";
import { capabilityNeeded, clearsReview, isDraftRequest, type Status } from "./rules";

// What the live version was when this save began. The `beforeChange` hook below records it on the request so the
// `afterChange` hooks (cache refresh, redirect on a changed address) can tell a publish from a draft save without asking
// the database again.
export interface LiveBefore {
  status: Status | undefined;
  slug: string | undefined;
  /** The live version's translated address in the language being saved (empty when it has none). */
  translatedSlug?: string | undefined;
}

const KEY = "polysiteLiveBefore";

export const liveBefore = (req: PayloadRequest): LiveBefore | undefined => (req.context as Record<string, unknown>)[KEY] as LiveBefore | undefined;

const forbidden = (message: string) => Object.assign(new Error(message), { status: 403, isPublic: true });

// Records the live version and enforces publish and unpublish permission for one collection's role module.
// A save with no signed-in user (a scheduled publish, first-run setup, a script) is the system acting and is not checked
// here: nobody can reach it from outside, because the collection's own access rules already turn anonymous writes away.
export function publishRules(collection: string, module: string): CollectionBeforeChangeHook {
  return async ({ data, originalDoc, req, operation }) => {
    const isDraftSave = isDraftRequest(req.query);

    let live: Record<string, unknown> | null = null;
    if (operation === "update" && originalDoc?.id !== undefined) {
      live = (await req.payload
        .findByID({ collection: collection as never, id: originalDoc.id, draft: false, depth: 0, overrideAccess: true, req })
        .catch(() => null)) as Record<string, unknown> | null;
    }
    const liveStatus = (live?._status as Status | undefined) ?? undefined;
    (req.context as Record<string, unknown>)[KEY] = { status: liveStatus, slug: live?.slug as string | undefined, translatedSlug: (live?.translatedSlug as string | null | undefined) || undefined } satisfies LiveBefore;

    // Publishing finishes a review (also when the system publishes on a schedule).
    const requestedStatus = (data as { _status?: Status })?._status;
    if (clearsReview({ isDraftSave, requestedStatus }) && data) Object.assign(data, { reviewState: "none", reviewNote: null });

    if (!req.user) return data;
    const needed = capabilityNeeded({ isDraftSave, requestedStatus, liveStatus });
    if (needed && !hasCapability(req.user, module, needed)) {
      throw forbidden(
        needed === "publish"
          ? "You don't have permission to publish. Save it as a draft and ask someone who can publish."
          : "You don't have permission to unpublish.",
      );
    }
    return data;
  };
}

// Wraps a collection's "update" access so that setting a document to published needs the publish capability. This is what
// Payload's admin looks at to show or hide "Publish changes" and "Schedule publish", and it is why someone without the
// capability cannot schedule a publish (the scheduled job later runs as that person). The hook above is the same rule
// again at the point of writing, and the only place unpublish is checked.
export function publishAware(module: string, base: Access): Access {
  return async (args) => {
    const allowed = await base(args);
    if (!allowed) return allowed;
    const requested = (args.data as { _status?: Status } | undefined)?._status;
    if (requested === "published" && !isDraftRequest(args.req.query) && args.req.user && !hasCapability(args.req.user, module, "publish")) return false;
    return allowed;
  };
}
