import { describe, expect, it } from "vitest";

import { addressIn, normalizeTranslatedSlug, translatedRedirectFrom, translatedSlugProblem } from "./translatedSlug";

describe("a translated address", () => {
  it("keeps letters and digits of any script and turns the rest into one hyphen", () => {
    expect(normalizeTranslatedSlug("  À Propos de Nous ")).toBe("à-propos-de-nous");
    expect(normalizeTranslatedSlug("من نحن")).toBe("من-نحن");
    expect(normalizeTranslatedSlug("О нас/Команда")).toBe("о-нас/команда");
    expect(normalizeTranslatedSlug("/équipe//et--dons/")).toBe("équipe/et-dons");
    expect(normalizeTranslatedSlug("a_b?c#d")).toBe("a-b-c-d");
    expect(normalizeTranslatedSlug("/")).toBe("");
  });

  it("matches the ASCII rules of the shared slug for ASCII input", () => {
    expect(normalizeTranslatedSlug("About Us")).toBe("about-us");
    expect(normalizeTranslatedSlug("team/our-people")).toBe("team/our-people");
  });

  it("refuses the default language, the site's own addresses and language codes", () => {
    const offered = ["en", "fr", "ar"];
    expect(translatedSlugProblem("a-propos", "fr", offered)).toBeNull();
    expect(translatedSlugProblem("", "en", offered)).toBeNull();
    expect(translatedSlugProblem("a-propos", "en", offered)).toMatch(/default language/);
    expect(translatedSlugProblem("a-propos", undefined, offered)).toMatch(/default language/);
    expect(translatedSlugProblem("api/x", "fr", offered)).toMatch(/used by the site/);
    expect(translatedSlugProblem("ar", "fr", offered)).toMatch(/language code/);
    expect(translatedSlugProblem("FR/x", "ar", offered)).toMatch(/language code/); // the check ignores case
  });

  it("gives a page its own address only in another language, and never to the home page", () => {
    const page = { slug: "about", translatedSlug: "a-propos" };
    expect(addressIn(page, "fr", "en")).toBe("a-propos");
    expect(addressIn(page, "en", "en")).toBe("about");
    expect(addressIn(page, undefined, "en")).toBe("about");
    expect(addressIn({ slug: "about", translatedSlug: "" }, "fr", "en")).toBe("about");
    expect(addressIn({ slug: "about" }, "fr", "en")).toBe("about");
    expect(addressIn({ slug: "/", translatedSlug: "accueil" }, "fr", "en")).toBe("/");
  });

  it("redirects an old translated address, with its language in front", () => {
    expect(translatedRedirectFrom("fr", "en", "a-propos", "a-propos-nous")).toBe("fr/a-propos");
    expect(translatedRedirectFrom("fr", "en", "a-propos", undefined)).toBe("fr/a-propos");
    expect(translatedRedirectFrom("fr", "en", "a-propos", "a-propos")).toBeNull();
    expect(translatedRedirectFrom("fr", "en", undefined, "a-propos")).toBeNull();
    expect(translatedRedirectFrom("en", "en", "x", "y")).toBeNull();
  });
});
