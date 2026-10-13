import { randomUUID } from "node:crypto";

import { getFieldsToSign, jwtSign, type CollectionSlug, type Payload } from "payload";
import { generatePayloadCookie } from "payload/shared";

// Signs a person in without a password: the same session record, token and cookie a password sign-in produces, so
// logout, expiry and every access check treat it identically. It exists for sign-in methods that prove who someone is in
// another way (single sign-on). It does NOT check that the person may sign in: the caller has already done that.
// Plugins can't import Payload's token functions, so the core offers this through the plugin kit.
export interface CreatedSession {
  token: string;
  /** Seconds since the epoch, when the token stops working. */
  exp: number;
  /** A ready `Set-Cookie` value. */
  cookie: string;
}

export async function createSession(payload: Payload, slug: string, userId: string | number): Promise<CreatedSession> {
  const collectionSlug = slug as CollectionSlug;
  const collection = payload.collections[collectionSlug];
  if (!collection) throw new Error(`createSession: no collection called "${slug}"`);
  const config = collection.config;
  const user = (await payload.findByID({
    collection: collectionSlug,
    id: userId,
    depth: 0,
    overrideAccess: true,
    showHiddenFields: true,
  })) as unknown as Record<string, unknown> & { id: string | number; email: string; sessions?: { id: string; expiresAt: string | Date }[] };

  let sid: string | undefined;
  if (config.auth.useSessions) {
    sid = randomUUID();
    const now = new Date();
    const live = (user.sessions ?? []).filter((s) => new Date(s.expiresAt) > now);
    const session = { id: sid, createdAt: now, expiresAt: new Date(now.getTime() + config.auth.tokenExpiration * 1000) };
    // Straight to the adapter, as Payload does for a password sign-in: this is bookkeeping, not an edit. The WHOLE document
    // goes in (as Payload does too): the adapter rewrites every array field of the row from what it is given, so a write
    // naming only `sessions` would empty `assignedSites` and every other array on the user.
    await payload.db.updateOne({
      collection: collectionSlug,
      id: user.id,
      data: { ...user, sessions: [...live, session], updatedAt: null },
      returning: false,
    });
  }

  const fieldsToSign = getFieldsToSign({ collectionConfig: config, email: user.email, user: { ...user, collection: collectionSlug } as never, sid });
  const { token, exp } = await jwtSign({ fieldsToSign, secret: payload.secret, tokenExpiration: config.auth.tokenExpiration });
  const cookie = generatePayloadCookie({ collectionAuthConfig: config.auth, cookiePrefix: payload.config.cookiePrefix, token });
  return { token, exp, cookie };
}
