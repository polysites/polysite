import { describe, expect, it } from "vitest";

import { pageHref, resolveRedirectTarget } from "./usePayloadPage";

describe("pageHref", () => {
  it("preserves the homepage sentinel slug", () => {
    expect(pageHref("/")).toBe("/");
  });

  it("prefixes a real slug with a single leading slash", () => {
    expect(pageHref("about")).toBe("/about");
  });

  it("doesn't double up a slug that already starts with a slash", () => {
    expect(pageHref("/about")).toBe("/about");
  });
});

describe("resolveRedirectTarget", () => {
  it("returns null for no redirect", () => {
    expect(resolveRedirectTarget(null)).toBeNull();
  });

  it("resolves an external redirect using its own URL and status code", () => {
    const result = resolveRedirectTarget({
      redirectType: "external",
      toUrl: "https://example.com",
      statusCode: 302,
    });
    expect(result).toEqual({ href: "https://example.com", statusCode: 302, external: true });
  });

  it("defaults to a 301 when no status code is set", () => {
    const result = resolveRedirectTarget({ redirectType: "external", toUrl: "https://example.com" });
    expect(result?.statusCode).toBe(301);
  });

  it("returns null for an external redirect with no URL", () => {
    expect(resolveRedirectTarget({ redirectType: "external", toUrl: "" })).toBeNull();
  });

  it("resolves an internal redirect to a page", () => {
    const result = resolveRedirectTarget({
      toTarget: { relationTo: "pages", value: { slug: "about" } },
    });
    expect(result).toEqual({ href: "/about", statusCode: 301, external: false });
  });

  it("resolves an internal redirect to the homepage page", () => {
    const result = resolveRedirectTarget({
      toTarget: { relationTo: "pages", value: { slug: "/" } },
    });
    expect(result?.href).toBe("/");
  });

  it("resolves an internal redirect to media by its own url", () => {
    const result = resolveRedirectTarget({
      toTarget: { relationTo: "media", value: { url: "/uploads/file.pdf" } },
    });
    expect(result).toEqual({ href: "/uploads/file.pdf", statusCode: 301, external: false });
  });

  it("resolves an internal redirect to a form via its landing page", () => {
    const result = resolveRedirectTarget({
      toTarget: { relationTo: "forms", value: { landingPage: { slug: "contact" } } },
    });
    expect(result?.href).toBe("/contact");
  });

  it("returns null for a form with no landing page populated", () => {
    const result = resolveRedirectTarget({
      toTarget: { relationTo: "forms", value: { landingPage: null } },
    });
    expect(result).toBeNull();
  });

  it("returns null when toTarget.value isn't populated", () => {
    const result = resolveRedirectTarget({
      toTarget: { relationTo: "pages", value: "unpopulated-id" },
    });
    expect(result).toBeNull();
  });
});
