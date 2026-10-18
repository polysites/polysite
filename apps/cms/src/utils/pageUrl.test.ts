import { describe, expect, it } from "vitest";

import { buildPageUrl, languageForPreview } from "./pageUrl";

describe("buildPageUrl", () => {
  it("returns the bare origin for the homepage slug", () => {
    expect(buildPageUrl("voidslate.localhost", "/")).toBe("http://voidslate.localhost");
  });
  it("joins a nested slug without doubling slashes", () => {
    expect(buildPageUrl("bakery.localhost", "about/team", "https")).toBe("https://bakery.localhost/about/team");
    expect(buildPageUrl("bakery.localhost", "/about")).toBe("http://bakery.localhost/about");
  });
  it("falls back to the origin for a missing slug", () => {
    expect(buildPageUrl("a.test", undefined)).toBe("http://a.test");
  });
});

describe("addresses in a language", () => {
  const setting = { languages: ["en", "fr", "ar"], defaultLanguage: "en", previewLanguages: ["ar"] };

  it("puts the language's prefix on every language but the default", async () => {
    expect(buildPageUrl("a.test", "about", "http", { code: "fr" })).toBe("http://a.test/fr/about");
    expect(buildPageUrl("a.test", "/", "http", { code: "fr" })).toBe("http://a.test/fr");
    expect(buildPageUrl("a.test", "about", "http", {})).toBe("http://a.test/about");
  });

  it("adds a signed token only for a language set to preview only", async () => {
    expect(await languageForPreview(setting, "en", "a.test", "s")).toEqual({});
    expect(await languageForPreview(setting, "fr", "a.test", "s")).toEqual({ code: "fr" });
    const hidden = await languageForPreview(setting, "ar", "a.test", "s");
    expect(hidden.code).toBe("ar");
    expect(hidden.token).toMatch(/^ar\.\d+\.[0-9a-f]{64}$/);
    expect(buildPageUrl("a.test", "about", "http", hidden)).toBe(`http://a.test/ar/about?_pl=${hidden.token}`);
  });

  it("ignores a language the site does not offer, and an unset site", async () => {
    expect(await languageForPreview(setting, "de", "a.test", "s")).toEqual({});
    expect(await languageForPreview(undefined, "fr", "a.test", "s")).toEqual({});
  });
});
