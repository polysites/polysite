import { describe, expect, it } from "vitest";

import { addressInLanguage, directionOf, isRtl, languageQuery, languagesOf, nameOf, SINGLE_LANGUAGE, splitLanguage, withLanguage } from "./language";

// A site as the CMS returns it: the language choice is the `languages` extension (supplied by a plugin; the core only reads it).
const siteWith = (languages: unknown, defaultLanguage?: unknown) => ({ extensions: { languages: { languages, defaultLanguage } } }) as never;

const setup = languagesOf(siteWith(["en", "fr", "pt-BR", "ar"], "en"));

describe("what a site offers", () => {
  it("is English only when nothing is set, which is every site without the plugin", () => {
    for (const site of [null, undefined, {}, { extensions: {} }, { extensions: { languages: null } }, siteWith([]), siteWith("fr")]) expect(languagesOf(site as never)).toEqual(SINGLE_LANGUAGE);
    // The old shape (languages on the site itself) is not read: the choice is the plugin's extension, not a field of the site.
    expect(languagesOf({ languages: ["fr", "en"], defaultLanguage: "fr" } as never)).toEqual(SINGLE_LANGUAGE);
  });

  it("puts the default first, and falls back to the first listed when the default is not offered", () => {
    expect(languagesOf(siteWith(["fr", "en"], "en"))).toEqual({ default: "en", languages: ["en", "fr"] });
    expect(languagesOf(siteWith(["fr", "de"], "xx"))).toEqual({ default: "fr", languages: ["fr", "de"] });
    expect(languagesOf(siteWith(["fr", "en"]))).toEqual({ default: "fr", languages: ["fr", "en"] });
  });
});

describe("reading the language out of an address", () => {
  it("takes an offered, non-default language as the prefix and leaves the rest", () => {
    expect(splitLanguage("/fr/about", setup)).toEqual({ code: "fr", rest: "about" });
    expect(splitLanguage("fr/news/big-day", setup)).toEqual({ code: "fr", rest: "news/big-day" });
    expect(splitLanguage("/fr", setup)).toEqual({ code: "fr", rest: "" });
    expect(splitLanguage("/FR/About", setup)).toEqual({ code: "fr", rest: "About" });
    expect(splitLanguage("/pt-br/x", setup)).toEqual({ code: "pt-BR", rest: "x" });
  });

  it("treats everything else as the default language, so no existing address changes", () => {
    expect(splitLanguage("/about", setup)).toEqual({ code: "en", rest: "about" });
    expect(splitLanguage("/", setup)).toEqual({ code: "en", rest: "" });
    expect(splitLanguage("/en/about", setup)).toEqual({ code: "en", rest: "en/about" });
    expect(splitLanguage("/de/about", setup)).toEqual({ code: "en", rest: "de/about" });
    expect(splitLanguage("/about?x=1#top", setup)).toEqual({ code: "en", rest: "about" });
  });

  it("a one-language site never reads a prefix", () => {
    expect(splitLanguage("/fr/about", SINGLE_LANGUAGE)).toEqual({ code: "en", rest: "fr/about" });
  });

  it("works when the default language is not English", () => {
    const french = languagesOf(siteWith(["fr", "en"], "fr"));
    expect(splitLanguage("/en/about", french)).toEqual({ code: "en", rest: "about" });
    expect(splitLanguage("/about", french)).toEqual({ code: "fr", rest: "about" });
  });
});

describe("putting a language on a link", () => {
  it("prefixes internal addresses for a non-default language", () => {
    expect(withLanguage("/about", "fr", setup)).toBe("/fr/about");
    expect(withLanguage("/", "fr", setup)).toBe("/fr");
    expect(withLanguage("/news/big-day?x=1", "fr", setup)).toBe("/fr/news/big-day?x=1");
  });

  it("leaves the default language, existing prefixes and things that are not pages alone", () => {
    expect(withLanguage("/about", "en", setup)).toBe("/about");
    expect(withLanguage("/fr/about", "fr", setup)).toBe("/fr/about");
    expect(withLanguage("/ar/about", "fr", setup)).toBe("/ar/about");
    for (const href of ["https://example.org/x", "//cdn.example.org/x", "mailto:a@b.org", "#top", "tel:123", "/api/media/file/a.png", "/_nuxt/x.js", "about"]) {
      expect(withLanguage(href, "fr", setup)).toBe(href);
    }
  });
});

describe("direction, names and queries", () => {
  it("knows which languages read right to left", () => {
    expect(isRtl("ar")).toBe(true);
    expect(isRtl("he-IL")).toBe(true);
    expect(isRtl("fr")).toBe(false);
    expect(directionOf("fa")).toBe("rtl");
    expect(directionOf("en")).toBe("ltr");
  });

  it("names a language in itself", () => {
    expect(nameOf("fr").toLowerCase()).toContain("fran");
    expect(nameOf("xx-not-real")).toBeTruthy();
  });

  it("asks Payload for the language and falls back to the site's default", () => {
    expect(languageQuery("fr", setup)).toEqual({ locale: "fr", "fallback-locale": "en" });
  });
});

describe("languages set to preview only", () => {
  const withPreview = (languages: string[], previewLanguages: unknown, defaultLanguage = "en") => ({ extensions: { languages: { languages, defaultLanguage, previewLanguages } } }) as never;

  it("serves visitors only the live languages and remembers the hidden ones", () => {
    const s = languagesOf(withPreview(["en", "fr", "ar"], ["ar"]));
    expect(s).toEqual({ default: "en", languages: ["en", "fr"], preview: ["ar"] });
    expect(splitLanguage("/ar/about", s)).toEqual({ code: "en", rest: "ar/about" });
    expect(splitLanguage("/fr/about", s)).toEqual({ code: "fr", rest: "about" });
  });

  it("lets a signed link open one hidden language for that request", () => {
    const s = languagesOf(withPreview(["en", "fr", "ar"], ["fr", "ar"]), ["ar"]);
    expect(s.languages).toEqual(["en", "ar"]);
    expect(s.preview).toEqual(["fr"]);
  });

  it("never hides the default, ignores unlisted or malformed entries, and changes nothing when none are hidden", () => {
    expect(languagesOf(withPreview(["fr", "en"], ["fr"], "fr"))).toEqual({ default: "fr", languages: ["fr", "en"] });
    expect(languagesOf(withPreview(["en", "fr"], ["de", 4, ""]))).toEqual({ default: "en", languages: ["en", "fr"] });
    expect(languagesOf(withPreview(["en", "fr"], "fr"))).toEqual({ default: "en", languages: ["en", "fr"] });
  });
});

describe("the address of a page in a language", () => {
  const s = languagesOf(siteWith(["en", "fr", "ar"], "en"));

  it("uses the page's own address in a language that has one, and the shared address otherwise", () => {
    const localized = { en: "about", fr: "a-propos", ar: "about" };
    expect(addressInLanguage("about", localized, "en", s)).toBe("/about");
    expect(addressInLanguage("about", localized, "fr", s)).toBe("/fr/a-propos");
    expect(addressInLanguage("about", localized, "ar", s)).toBe("/ar/about");
    expect(addressInLanguage("/about", { fr: null }, "fr", s)).toBe("/fr/about");
    expect(addressInLanguage("about", undefined, "fr", s)).toBe("/fr/about");
    expect(addressInLanguage("about", "not-an-object", "fr", s)).toBe("/fr/about");
  });

  it("keeps the home page at the language's root, and never prefixes the default language", () => {
    expect(addressInLanguage("/", { fr: "/" }, "fr", s)).toBe("/fr");
    expect(addressInLanguage("/", {}, "en", s)).toBe("/");
    expect(addressInLanguage("about", { en: "other" }, "en", s)).toBe("/about");
  });

  it("keeps a native-script address as it is", () => {
    expect(addressInLanguage("about", { ar: "من-نحن" }, "ar", s)).toBe("/ar/من-نحن");
  });
});
