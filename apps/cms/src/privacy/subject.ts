import { createHmac } from "node:crypto";

/** How an email address is compared everywhere: trimmed and lower-cased. */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * A one-way fingerprint of an email address. It lets an erasure be remembered
 * (and re-applied after a restore from an older backup) without keeping the
 * address itself. Keyed with the server secret, so a leaked list of fingerprints
 * can't be checked against a list of known addresses.
 */
export function subjectHash(secret: string, email: string): string {
  return createHmac("sha256", secret).update(`subject:${normalizeEmail(email)}`).digest("hex");
}
