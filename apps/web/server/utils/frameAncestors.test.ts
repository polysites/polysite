import { describe, expect, it } from "vitest";
import { adminOrigin, withFrameAncestors } from "./frameAncestors";

describe("adminOrigin", () => {
  it("is empty when nothing is configured, so only the site itself may frame its pages", () => {
    expect(adminOrigin({})).toBe("");
  });
  it("builds the origin from CMS_SCHEME and CMS_DOMAIN, with a port when there is one", () => {
    expect(adminOrigin({ CMS_DOMAIN: "admin.example.org", CMS_SCHEME: "https" })).toBe("https://admin.example.org");
    expect(adminOrigin({ CMS_DOMAIN: "admin.localhost:8080" })).toBe("http://admin.localhost:8080");
  });
  it("prefers NUXT_CMS_ORIGIN, then NUXT_PUBLIC_CMS_SERVER_URL, then the domain", () => {
    const env = { NUXT_CMS_ORIGIN: "https://a.example.org/path?x=1", NUXT_PUBLIC_CMS_SERVER_URL: "https://b.example.org", CMS_DOMAIN: "c.example.org" };
    expect(adminOrigin(env)).toBe("https://a.example.org");
    expect(adminOrigin({ ...env, NUXT_CMS_ORIGIN: "" })).toBe("https://b.example.org");
    expect(adminOrigin({ ...env, NUXT_CMS_ORIGIN: "", NUXT_PUBLIC_CMS_SERVER_URL: "" })).toBe("http://c.example.org");
  });
  it("accepts a bare host name for NUXT_CMS_ORIGIN", () => {
    expect(adminOrigin({ NUXT_CMS_ORIGIN: "admin.example.org", CMS_SCHEME: "https" })).toBe("https://admin.example.org");
  });
  it("never puts a script or a malformed value into the header", () => {
    expect(adminOrigin({ NUXT_CMS_ORIGIN: "javascript:alert(1)" })).toBe("");
    expect(adminOrigin({ NUXT_CMS_ORIGIN: "https://x.example.org; script-src *" })).not.toContain(";");
  });
});

describe("withFrameAncestors", () => {
  const base = "default-src 'self'; img-src 'self' data: https:; frame-ancestors 'self'; upgrade-insecure-requests";
  it("replaces the directive and keeps the others", () => {
    expect(withFrameAncestors(base, "https://admin.example.org")).toBe(
      "default-src 'self'; img-src 'self' data: https:; frame-ancestors 'self' https://admin.example.org; upgrade-insecure-requests",
    );
  });
  it("leaves only 'self' when there is no origin", () => {
    expect(withFrameAncestors(base, "")).toContain("frame-ancestors 'self';");
    expect(withFrameAncestors(base, "")).not.toContain("https://admin");
  });
  it("adds the directive when the policy has none", () => {
    expect(withFrameAncestors("default-src 'self'", "http://a.localhost")).toBe("default-src 'self'; frame-ancestors 'self' http://a.localhost");
  });
  it("never produces two frame-ancestors directives", () => {
    const out = withFrameAncestors("frame-ancestors 'none'; Frame-Ancestors 'self'", "https://x.example.org");
    expect(out.match(/frame-ancestors/gi)?.length).toBe(1);
  });
});
