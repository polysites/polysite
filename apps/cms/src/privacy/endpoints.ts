import type { Endpoint, Payload, PayloadRequest } from "payload";

import { hasCapability } from "../access/roles";
import { buildExport, type StoredSubmission } from "./export";
import { normalizeEmail, subjectHash } from "./subject";

// The actions behind the buttons on a Privacy Request (components/PrivacyActions).
//
//   POST /api/privacy/requests/:id/find    how many submissions mention the email
//   POST /api/privacy/requests/:id/export  a JSON copy of them, to send to the person
//   POST /api/privacy/requests/:id/erase   delete them, and record that it was done
//
// A request belongs to one site, and these only ever look at that site's
// submissions, so one site's team can't reach another's data. The person is
// matched by email address (stored lower-cased), so information a visitor typed
// into a free-text box without their email beside it is not found; the guide
// says so.

type RequestDoc = { id: number | string; type: string; requesterEmail?: string | null; site?: number | string | { id: number | string } | null };

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

const siteIdOf = (site: RequestDoc["site"]) => (site && typeof site === "object" ? site.id : site);

async function authorize(req: PayloadRequest): Promise<{ doc: RequestDoc; siteId: number | string; email: string } | Response> {
  if (!req.user) return json({ message: "Sign in first." }, 401);
  if (!hasCapability(req.user, "privacy-requests", "update")) return json({ message: "Your role can't work privacy requests." }, 403);

  const id = req.routeParams?.id;
  if (typeof id !== "string" || !/^\d+$/.test(id)) return json({ message: "Request not found." }, 404);
  // Read with the user's own access, so the site scoping of the collection applies.
  const doc = (await req.payload
    .findByID({ collection: "privacy-requests", id, user: req.user, overrideAccess: false, depth: 0 })
    .catch(() => null)) as unknown as RequestDoc | null;
  if (!doc) return json({ message: "Request not found." }, 404);

  const siteId = siteIdOf(doc.site);
  if (siteId == null) return json({ message: "This request has no site." }, 400);
  if (!doc.requesterEmail) return json({ message: "Add the person's email address to the request first." }, 400);
  return { doc, siteId, email: normalizeEmail(doc.requesterEmail) };
}

async function submissionsFor(payload: Payload, siteId: number | string, email: string): Promise<StoredSubmission[]> {
  const found: StoredSubmission[] = [];
  for (let page = 1; ; page++) {
    const res = await payload.find({
      collection: "form-submissions",
      where: { and: [{ site: { equals: siteId } }, { "submissionData.value": { equals: email } }] },
      depth: 1,
      limit: 200,
      page,
      overrideAccess: true,
    });
    found.push(...(res.docs as unknown as StoredSubmission[]));
    if (!res.hasNextPage) break;
  }
  return found;
}

export const privacyFindEndpoint: Endpoint = {
  path: "/privacy/requests/:id/find",
  method: "post",
  handler: async (req) => {
    const auth = await authorize(req);
    if (auth instanceof Response) return auth;
    const matches = await submissionsFor(req.payload, auth.siteId, auth.email);
    await req.payload.update({ collection: "privacy-requests", id: auth.doc.id, data: { recordsFound: matches.length }, overrideAccess: true });
    const byForm: Record<string, number> = {};
    for (const m of matches) {
      const title = m.form && typeof m.form === "object" ? (m.form.title ?? "Form") : "Form";
      byForm[title] = (byForm[title] ?? 0) + 1;
    }
    return json({ count: matches.length, byForm });
  },
};

export const privacyExportEndpoint: Endpoint = {
  path: "/privacy/requests/:id/export",
  method: "post",
  handler: async (req) => {
    const auth = await authorize(req);
    if (auth instanceof Response) return auth;
    const matches = await submissionsFor(req.payload, auth.siteId, auth.email);
    return json(buildExport(auth.email, matches), 200, { "Content-Disposition": `attachment; filename="personal-information-request-${auth.doc.id}.json"` });
  },
};

export const privacyEraseEndpoint: Endpoint = {
  path: "/privacy/requests/:id/erase",
  method: "post",
  handler: async (req) => {
    const auth = await authorize(req);
    if (auth instanceof Response) return auth;
    if (auth.doc.type !== "erasure" && auth.doc.type !== "withdraw-consent") {
      return json({ message: "Only an erasure or withdraw-consent request can delete records." }, 400);
    }

    const matches = await submissionsFor(req.payload, auth.siteId, auth.email);
    for (const m of matches) {
      await req.payload.delete({ collection: "form-submissions", id: m.id, overrideAccess: true });
    }

    // Keep proof it was done, and a fingerprint, not the email address.
    await req.payload.update({
      collection: "privacy-requests",
      id: auth.doc.id,
      data: {
        status: "completed",
        completedAt: new Date().toISOString(),
        recordsFound: matches.length,
        subjectHash: subjectHash(process.env.PAYLOAD_SECRET || "", auth.email),
        requesterEmail: null,
      },
      overrideAccess: true,
    });
    req.payload.logger.info(`Privacy request ${auth.doc.id}: erased ${matches.length} submission(s) for site ${auth.siteId}`);
    return json({ erased: matches.length });
  },
};
