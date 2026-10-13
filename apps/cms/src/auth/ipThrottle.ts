import { APIError } from "payload";

// A per-address limit on signing in and on asking for a password-reset email. Payload already locks one ACCOUNT after a few wrong
// passwords, but nothing slowed one ADDRESS trying many accounts, or flooding reset emails. The stock Caddy image has no rate
// limiting, so this lives here: a sliding window in memory (the stack is one process on one VM; a restart forgets it, which only
// ever lets a few more attempts through). The address is the last entry of X-Forwarded-For, the one Caddy added.

export type ThrottleKind = "login" | "forgot";

const WINDOWS: Record<ThrottleKind, { limit: number; ms: number }> = {
  login: { limit: 20, ms: 10 * 60_000 },
  forgot: { limit: 5, ms: 15 * 60_000 },
};

const hits = new Map<string, number[]>();

const limitFor = (kind: ThrottleKind, env: Record<string, string | undefined>): number => {
  const raw = Number(env[kind === "login" ? "POLYSITE_LOGIN_RATE_LIMIT" : "POLYSITE_RESET_RATE_LIMIT"]);
  return Number.isInteger(raw) && raw > 0 ? raw : WINDOWS[kind].limit;
};

export function clientAddress(headers: Headers | undefined, fallback = ""): string {
  const forwarded = headers?.get("x-forwarded-for");
  if (forwarded) {
    const last = forwarded.split(",").map((s) => s.trim()).filter(Boolean).pop();
    if (last) return last;
  }
  return headers?.get("x-real-ip")?.trim() || fallback;
}

/** Counts one attempt and says how many seconds to wait if the address is over its limit (0 = allowed). */
export function noteAttempt(kind: ThrottleKind, address: string, now = Date.now(), env: Record<string, string | undefined> = process.env): number {
  const { ms } = WINDOWS[kind];
  const key = `${kind}:${address}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < ms);
  if (recent.length >= limitFor(kind, env)) {
    hits.set(key, recent);
    return Math.max(1, Math.ceil((recent[0] + ms - now) / 1000));
  }
  recent.push(now);
  hits.set(key, recent);
  // Keep the table small: drop addresses that have been quiet for a whole window.
  if (hits.size > 5000) for (const [k, list] of hits) if (list.every((t) => now - t >= ms)) hits.delete(k);
  return 0;
}

export function resetThrottle(): void {
  hits.clear();
}

/** A Payload `beforeOperation` hook for the users collection. */
export const throttleAuthOperations = ({ operation, req }: { operation: string; req?: { headers?: Headers } }): void => {
  const kind: ThrottleKind | null = operation === "login" ? "login" : operation === "forgotPassword" ? "forgot" : null;
  if (!kind) return;
  // No forwarded address means the call did not come through the proxy (the CMS talking to itself, a script inside the stack): nothing to limit.
  const address = clientAddress(req?.headers);
  if (!address) return;
  const wait = noteAttempt(kind, address);
  if (wait > 0) {
    const err = new APIError(kind === "login" ? "Too many sign-in attempts from this address. Try again later." : "Too many password-reset requests from this address. Try again later.", 429);
    throw err;
  }
};
