import { createHmac, timingSafeEqual } from "node:crypto";

// Spam protection for the public form endpoint. Three cheap layers that stop
// the overwhelming majority of bots without a CAPTCHA (and without sending
// visitors to a third party):
//   1. a hidden "honeypot" field a human never sees but a naive bot fills in;
//   2. a signed token issued when the form is loaded, which a bot that posts
//      straight to the endpoint won't have, and which must be a moment old;
//   3. a rate limit per visitor address.
// None of it is a guarantee against a determined attacker; it is a floor.

/** The honeypot input's name. Looks like something worth filling in. */
export const HONEYPOT_FIELD = "website_url";

export const MIN_FILL_MS = 1500; // faster than a person can read and type
export const MAX_TOKEN_AGE_MS = 6 * 60 * 60 * 1000;

function sign(secret: string, formId: string | number, issuedAt: number): string {
  return createHmac("sha256", secret).update(`${formId}.${issuedAt}`).digest("base64url");
}

export function issueToken(secret: string, formId: string | number, now = Date.now()): string {
  return `${now}.${sign(secret, formId, now)}`;
}

export type TokenCheck = "ok" | "missing" | "invalid" | "too-fast" | "expired";

export function checkToken(secret: string, formId: string | number, token: unknown, now = Date.now()): TokenCheck {
  if (typeof token !== "string" || !token) return "missing";
  const [issued, signature, ...rest] = token.split(".");
  const issuedAt = Number(issued);
  if (rest.length > 0 || !signature || !Number.isFinite(issuedAt)) return "invalid";

  const expected = Buffer.from(sign(secret, formId, issuedAt));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "invalid";

  const age = now - issuedAt;
  if (age < MIN_FILL_MS) return "too-fast";
  if (age > MAX_TOKEN_AGE_MS) return "expired";
  return "ok";
}

/** A sliding-window limiter held in memory: right for one server process. */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limits: { windowMs: number; max: number }[],
    private readonly clock: () => number = Date.now,
  ) {}

  /** Records an attempt and says whether it is allowed. */
  allow(key: string): boolean {
    const now = this.clock();
    const longest = Math.max(...this.limits.map((l) => l.windowMs));
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < longest);

    const allowed = this.limits.every((l) => recent.filter((t) => now - t < l.windowMs).length < l.max);
    if (allowed) recent.push(now);
    if (recent.length > 0) this.hits.set(key, recent);
    else this.hits.delete(key);

    // keep the map from growing without bound on a long-running server
    if (this.hits.size > 10_000) {
      for (const [k, times] of this.hits) if (now - (times[times.length - 1] ?? 0) >= longest) this.hits.delete(k);
    }
    return allowed;
  }
}

/** The visitor's address as the reverse proxy reports it, or "unknown". */
export function clientAddress(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip") || "unknown";
}
