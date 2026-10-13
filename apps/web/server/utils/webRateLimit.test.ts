import { describe, expect, it } from "vitest";
import { clientAddress, createLimiter, DEFAULT_LIMIT, DEFAULT_WINDOW_SECONDS, isExempt, limitedPage, readConfig } from "./webRateLimit";

describe("readConfig", () => {
  it("defaults to 600 requests a minute per address, proxy trusted, no custom header", () => {
    expect(readConfig({})).toEqual({ off: false, limit: DEFAULT_LIMIT, windowSeconds: DEFAULT_WINDOW_SECONDS, ipHeader: "", trustProxy: true });
    expect(DEFAULT_LIMIT).toBe(600);
    expect(DEFAULT_WINDOW_SECONDS).toBe(60);
  });

  it("reads the limit and the window from the environment, ignoring nonsense", () => {
    expect(readConfig({ POLYSITE_WEB_RATE_LIMIT: "1200", POLYSITE_WEB_RATE_WINDOW_SECONDS: "30" })).toMatchObject({ limit: 1200, windowSeconds: 30 });
    expect(readConfig({ POLYSITE_WEB_RATE_LIMIT: "lots", POLYSITE_WEB_RATE_WINDOW_SECONDS: "-5" })).toMatchObject({ limit: 600, windowSeconds: 60 });
    expect(readConfig({ POLYSITE_WEB_RATE_LIMIT: "12.5" }).limit).toBe(600);
  });

  it("switches off with POLYSITE_WEB_RATE_LIMIT_OFF or a limit of 0", () => {
    expect(readConfig({ POLYSITE_WEB_RATE_LIMIT_OFF: "1" }).off).toBe(true);
    expect(readConfig({ POLYSITE_WEB_RATE_LIMIT_OFF: "true" }).off).toBe(true);
    expect(readConfig({ POLYSITE_WEB_RATE_LIMIT_OFF: "0" }).off).toBe(false);
    expect(readConfig({ POLYSITE_WEB_RATE_LIMIT: "0" }).off).toBe(true);
  });

  it("takes the address header and the trust switch", () => {
    expect(readConfig({ POLYSITE_WEB_RATE_LIMIT_IP_HEADER: " CF-Connecting-IP " }).ipHeader).toBe("cf-connecting-ip");
    expect(readConfig({ POLYSITE_WEB_TRUST_PROXY: "0" }).trustProxy).toBe(false);
    expect(readConfig({ POLYSITE_WEB_TRUST_PROXY: "1" }).trustProxy).toBe(true);
  });
});

describe("isExempt", () => {
  it("exempts the build's files, images, fonts and the stack's own calls", () => {
    for (const p of ["/_nuxt/entry.abc.js", "/_ipx/w_800/uploads/a.jpg", "/_fonts/lora.woff2", "/_nuxt_icon/mdi.json", "/favicon.ico", "/logo.svg", "/x/y.WEBP", "/api/health", "/api/revalidate"]) {
      expect(isExempt(p), p).toBe(true);
    }
  });
  it("counts pages", () => {
    for (const p of ["/", "/about", "/news/a-post", "/robots.txt", "/sitemap.xml", "/api/search", "/search"]) expect(isExempt(p), p).toBe(false);
  });
});

describe("clientAddress", () => {
  const headers = (h: Record<string, string>) => (name: string) => h[name.toLowerCase()];
  const base = readConfig({});

  it("uses the last X-Forwarded-For entry, the one the proxy added, so a forged first entry changes nothing", () => {
    expect(clientAddress(headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }), "172.18.0.5", base)).toBe("203.0.113.9");
    expect(clientAddress(headers({ "x-forwarded-for": "203.0.113.9" }), "172.18.0.5", base)).toBe("203.0.113.9");
  });
  it("falls back to the connection's address without the header", () => {
    expect(clientAddress(headers({}), "172.18.0.5", base)).toBe("172.18.0.5");
  });
  it("ignores X-Forwarded-For entirely when the proxy is not trusted", () => {
    const cfg = readConfig({ POLYSITE_WEB_TRUST_PROXY: "0" });
    expect(clientAddress(headers({ "x-forwarded-for": "6.6.6.6" }), "198.51.100.7", cfg)).toBe("198.51.100.7");
  });
  it("uses the CDN header when configured, and falls back when a request lacks it", () => {
    const cfg = readConfig({ POLYSITE_WEB_RATE_LIMIT_IP_HEADER: "CF-Connecting-IP" });
    expect(clientAddress(headers({ "cf-connecting-ip": "203.0.113.50", "x-forwarded-for": "104.16.0.1" }), "172.18.0.5", cfg)).toBe("203.0.113.50");
    expect(clientAddress(headers({ "x-forwarded-for": "104.16.0.1" }), "172.18.0.5", cfg)).toBe("104.16.0.1");
  });
  it("returns an empty string when there is no address at all", () => {
    expect(clientAddress(headers({}), undefined, base)).toBe("");
  });
});

describe("createLimiter", () => {
  const cfg = { limit: 3, windowSeconds: 60 };

  it("lets the cap through and refuses the next request with a wait time", () => {
    const l = createLimiter();
    const t0 = 1_000_000;
    expect([1, 2, 3].map((i) => l.hit("a", cfg, t0 + i).allowed)).toEqual([true, true, true]);
    const over = l.hit("a", cfg, t0 + 10_000);
    expect(over.allowed).toBe(false);
    expect(over.retryAfter).toBe(51);
  });
  it("counts each address on its own", () => {
    const l = createLimiter();
    for (let i = 0; i < 3; i++) l.hit("a", cfg, 0);
    expect(l.hit("a", cfg, 1).allowed).toBe(false);
    expect(l.hit("b", cfg, 1).allowed).toBe(true);
  });
  it("starts a new window once the old one ends", () => {
    const l = createLimiter();
    for (let i = 0; i < 4; i++) l.hit("a", cfg, 0);
    expect(l.hit("a", cfg, 59_999).allowed).toBe(false);
    expect(l.hit("a", cfg, 60_000).allowed).toBe(true);
  });
  it("never reports a wait of less than a second", () => {
    const l = createLimiter();
    for (let i = 0; i < 3; i++) l.hit("a", cfg, 0);
    expect(l.hit("a", cfg, 59_999).retryAfter).toBe(1);
  });
});

describe("limitedPage", () => {
  it("is a plain page that says how long to wait", () => {
    const html = limitedPage(30);
    expect(html).toContain("<h1>Too many requests</h1>");
    expect(html).toContain("30 seconds");
    expect(html).not.toContain("<script");
    expect(limitedPage(120)).toContain("2 minutes");
  });
});
