import { describe, expect, it } from "vitest";

import { pageHref, pickPage, pickRedirect, resolveRedirectTarget } from "./usePayloadPage";

describe("finding a page by its address in a language", () => {
  const about = { slug: "about", translatedSlug: "a-propos" };
  const other = { slug: "a-propos-de", translatedSlug: null };

  it("takes the first result in the default language, where translated addresses are not used", () => {
    expect(pickPage([about], "about", false)).toBe(about);
    expect(pickPage([], "about", false)).toBeNull();
  });

  it("prefers the page whose address in this language it is, then the page with that shared address", () => {
    expect(pickPage([other, about], "a-propos", true)).toBe(about);
    expect(pickPage([about], "about", true)).toBe(about);
    expect(pickPage([other], "a-propos-de", true)).toBe(other);
    expect(pickPage([about], "nothing", true)).toBeNull();
  });

  it("prefers a redirect for the exact address in the language", () => {
    const plain = { fromPath: "old" } as never;
    const french = { fromPath: "fr/old" } as never;
    expect(pickRedirect([plain, french], "fr/old")).toBe(french);
    expect(pickRedirect([plain], "fr/old")).toBe(plain);
    expect(pickRedirect([], "fr/old")).toBeNull();
  });

  it("sends a redirect to the page's own address in another language", () => {
    const redirect = { redirectType: "internal", toTarget: { relationTo: "pages", value: { slug: "about", translatedSlug: "a-propos" } } } as never;
    expect(resolveRedirectTarget(redirect, true)?.href).toBe("/a-propos");
    expect(resolveRedirectTarget(redirect, false)?.href).toBe("/about");
    const none = { redirectType: "internal", toTarget: { relationTo: "pages", value: { slug: "about", translatedSlug: null } } } as never;
    expect(resolveRedirectTarget(none, true)?.href).toBe("/about");
  });
});

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
