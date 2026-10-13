// A per-address request cap for the public site. It replaces nuxt-security's built-in limiter, which allowed 150 requests per
// 5 minutes per address on every route, with no way to change it from the environment, no Retry-After and no exemption for static
// files: a petition site behind one office network, a mobile carrier or a CDN hit it within a minute. Everything here is plain
// functions so the behaviour is unit tested without a server.
//
// Counts live in the memory of this one process (the stack runs one web container); a restart forgets them, which only ever lets
// a few extra requests through. The form-intake and search limits are separate, enforced by the CMS, and are not touched here.

export interface WebRateLimitConfig {
  off: boolean;
  limit: number;
  windowSeconds: number;
  /** Name of a request header that carries the real visitor address (CF-Connecting-IP behind Cloudflare). Empty = use X-Forwarded-For. */
  ipHeader: string;
  /** Read the address from X-Forwarded-For (the entry the proxy added). false = use the address of the connection itself. */
  trustProxy: boolean;
}

export const DEFAULT_LIMIT = 600;
export const DEFAULT_WINDOW_SECONDS = 60;

type Env = Record<string, string | undefined>;

const positiveInt = (raw: string | undefined, fallback: number): number => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

const isOn = (raw: string | undefined): boolean => ["1", "true", "yes", "on"].includes((raw ?? "").trim().toLowerCase());

/** POLYSITE_WEB_RATE_LIMIT=0 switches the cap off, like POLYSITE_SEARCH_RATE_LIMIT=0 does for search. */
export function readConfig(env: Env = process.env): WebRateLimitConfig {
  const rawLimit = (env.POLYSITE_WEB_RATE_LIMIT ?? "").trim();
  return {
    off: isOn(env.POLYSITE_WEB_RATE_LIMIT_OFF) || rawLimit === "0",
    limit: positiveInt(rawLimit, DEFAULT_LIMIT),
    windowSeconds: positiveInt(env.POLYSITE_WEB_RATE_WINDOW_SECONDS, DEFAULT_WINDOW_SECONDS),
    ipHeader: (env.POLYSITE_WEB_RATE_LIMIT_IP_HEADER ?? "").trim().toLowerCase(),
    trustProxy: !["0", "false", "no", "off"].includes((env.POLYSITE_WEB_TRUST_PROXY ?? "").trim().toLowerCase()),
  };
}

// Files served by the build, not pages: a page view pulls a dozen of these, and Caddy normally answers them without reaching this app.
const STATIC_PREFIXES = ["/_nuxt/", "/_ipx/", "/_fonts/", "/_nuxt_icon", "/__nuxt", "/_scripts/"];
const STATIC_EXTENSION = /\.(?:js|mjs|css|map|woff2?|ttf|otf|eot|png|jpe?g|gif|webp|avif|svg|ico|mp4|webm|mp3|wav|ogg)$/i;
// Health checks and the CMS's publish webhook come from inside the stack (a handful of addresses, many calls).
const INTERNAL_PATHS = ["/api/health", "/api/revalidate"];

export function isExempt(pathname: string): boolean {
  if (INTERNAL_PATHS.includes(pathname)) return true;
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return STATIC_EXTENSION.test(pathname);
}

const firstValue = (v: string | undefined): string => (v ?? "").split(",")[0].trim();
const lastValue = (v: string | undefined): string => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean).pop() ?? "";

/**
 * The visitor's address. Behind the bundled Caddy (or any proxy that appends the address it saw) that is the LAST entry of
 * X-Forwarded-For: the one the proxy added, which a visitor cannot forge, the same rule the CMS uses for sign-in limits. Behind a
 * CDN set POLYSITE_WEB_RATE_LIMIT_IP_HEADER (CF-Connecting-IP for Cloudflare) so each visitor, not the CDN's edge, is counted.
 * An empty result means "not a visitor request" (the stack calling itself) and is never limited.
 */
export function clientAddress(header: (name: string) => string | undefined, socketAddress: string | undefined, cfg: WebRateLimitConfig): string {
  if (cfg.ipHeader) {
    const fromHeader = firstValue(header(cfg.ipHeader));
    if (fromHeader) return fromHeader;
  }
  if (cfg.trustProxy) {
    const forwarded = lastValue(header("x-forwarded-for"));
    if (forwarded) return forwarded;
  }
  return (socketAddress ?? "").trim();
}

export interface Verdict {
  allowed: boolean;
  /** Seconds until the address may try again (0 when allowed). */
  retryAfter: number;
}

interface Bucket { count: number; resetAt: number }

export function createLimiter() {
  const buckets = new Map<string, Bucket>();
  return {
    /** Counts one request from `address` and says whether it is within the cap. A fixed window per address. */
    hit(address: string, cfg: Pick<WebRateLimitConfig, "limit" | "windowSeconds">, now = Date.now()): Verdict {
      let b = buckets.get(address);
      if (!b || now >= b.resetAt) {
        b = { count: 0, resetAt: now + cfg.windowSeconds * 1000 };
        buckets.set(address, b);
        // Keep the table small: drop addresses whose window ended.
        if (buckets.size > 10_000) for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
      }
      if (b.count >= cfg.limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
      b.count += 1;
      return { allowed: true, retryAfter: 0 };
    },
    reset(): void {
      buckets.clear();
    },
  };
}

/** A plain page for a visitor over the cap: no framework, no scripts, no web fonts, readable in light and dark. */
export function limitedPage(retryAfter: number): string {
  const wait = retryAfter >= 60 ? `${Math.ceil(retryAfter / 60)} minute${Math.ceil(retryAfter / 60) === 1 ? "" : "s"}` : `${retryAfter} second${retryAfter === 1 ? "" : "s"}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Too many requests</title>
<style>:root{color-scheme:light dark}body{font:1.125rem/1.6 system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1rem}</style></head>
<body><main><h1>Too many requests</h1><p>This address has made a lot of requests in a short time. Please wait about ${wait} and try again.</p></main></body></html>
`;
}
