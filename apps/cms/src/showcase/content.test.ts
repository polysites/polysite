import { describe, expect, it } from "vitest";

import {
  altBeside,
  altFromPath,
  firstDifference,
  availableBlocks,
  collectImages,
  crossChecks,
  formData,
  holds,
  mapBlock,
  overlay,
  pageSlug,
  siteFields,
  siteTranslation,
  slugify,
  translatesSite,
  usedFormKeys,
  withIds,
} from "./content";

const ctx = {
  mediaId: (p: string) => `media:${p}`,
  formId: (k: string) => `form:${k}`,
};

describe("pageSlug / slugify", () => {
  it("maps home and / to the front page's own slug", () => {
    expect(pageSlug("home")).toBe("/");
    expect(pageSlug("/")).toBe("/");
    expect(pageSlug("about/team")).toBe("about/team");
  });
  it("makes a plain slug from a name", () => {
    expect(slugify("Open evenings & more")).toBe("open-evenings-more");
    expect(slugify("Café Crème")).toBe("cafe-creme");
  });
});

describe("images", () => {
  it("reads the alt text beside a picture, the specific key first", () => {
    expect(altBeside({ image: "i", alt: "plain" }, "image")).toBe("plain");
    expect(altBeside({ image: "i", imageAlt: "specific", alt: "plain" }, "image")).toBe("specific");
    expect(altBeside({ image: "i" }, "image")).toBeUndefined();
  });

  it("collects each file once with the first alt text found, from every place", () => {
    const site = {
      name: "Salon",
      logo: "images/logo.svg",
      pages: [
        {
          blocks: [
            { blockType: "hero", image: "images/hero.svg", alt: "A room" },
            { blockType: "gallery", images: [{ image: "images/a.svg" }, { image: "images/a.svg", alt: "Late alt" }, { image: "images/hero.svg", alt: "Other" }] },
            { blockType: "team", members: [{ name: "x", image: "images/p.svg", alt: "Portrait" }] },
          ],
        },
      ],
      posts: [{ image: "images/post.svg", alt: "A post" }],
    };
    expect(collectImages(site)).toEqual([
      { path: "images/logo.svg", alt: "Salon" },
      { path: "images/hero.svg", alt: "A room" },
      { path: "images/a.svg", alt: "Late alt" },
      { path: "images/p.svg", alt: "Portrait" },
      { path: "images/post.svg", alt: "A post" },
    ]);
  });

  it("makes a readable alt from a file name", () => {
    expect(altFromPath("images/hero-salon_wide.svg")).toBe("hero salon wide");
  });
});

describe("mapBlock", () => {
  it("replaces picture paths by media ids and drops the alt keys", () => {
    const out = mapBlock({ blockType: "hero", heading: "H", image: "images/h.svg", alt: "x", ctaHref: "/a" }, ctx);
    expect(out).toEqual({ blockType: "hero", heading: "H", image: "media:images/h.svg", ctaHref: "/a" });
  });

  it("maps pictures inside lists", () => {
    const out = mapBlock({ blockType: "gallery", columns: 3, images: [{ image: "images/a.svg", alt: "a", caption: "c" }] }, ctx);
    expect(out).toEqual({ blockType: "gallery", columns: 3, images: [{ image: "media:images/a.svg", caption: "c" }] });
  });

  it("turns a text block's body markup into rich text", () => {
    const out = mapBlock({ blockType: "textBlock", heading: "T", body: "One.\n\nTwo **bold**." }, ctx);
    expect(out.body.root.children).toHaveLength(2);
    expect(out.body.root.children[1].children[1]).toMatchObject({ text: "bold", format: 1 });
  });

  it("leaves a body alone on other blocks", () => {
    const out = mapBlock({ blockType: "cta", heading: "H", text: "t", buttonLabel: "b", buttonHref: "/b" }, ctx);
    expect(out.text).toBe("t");
  });

  it("resolves form keys on the form blocks only", () => {
    expect(mapBlock({ blockType: "formEmbed", form: "booking" }, ctx).form).toBe("form:booking");
    expect(mapBlock({ blockType: "signupForm", heading: "h", form: "news" }, ctx).form).toBe("form:news");
  });
});

describe("availableBlocks", () => {
  it("drops blocks whose plugin is not installed and names them", () => {
    const { kept, dropped } = availableBlocks([{ blockType: "hero" }, { blockType: "gallery" }, { blockType: "stats" }, { blockType: "gallery" }], new Set(["hero"]));
    expect(kept).toEqual([{ blockType: "hero" }]);
    expect(dropped).toEqual(["gallery", "stats", "gallery"]);
  });
});

describe("overlay", () => {
  it("lays a translation over the default by position", () => {
    const base = [{ blockType: "featureGrid", heading: "Services", features: [{ title: "One", description: "d1" }, { title: "Two", description: "d2" }] }, { blockType: "cta", heading: "Book" }];
    const over = [{ heading: "Soins", features: [{ title: "Un" }, null] }, null];
    expect(overlay(base, over)).toEqual([
      { blockType: "featureGrid", heading: "Soins", features: [{ title: "Un", description: "d1" }, { title: "Two", description: "d2" }] },
      { blockType: "cta", heading: "Book" },
    ]);
  });
  it("keeps the base when there is nothing to lay over it", () => {
    expect(overlay({ a: 1 }, undefined)).toEqual({ a: 1 });
    expect(overlay([{ a: 1 }], [{}])).toEqual([{ a: 1 }]);
  });
});

describe("withIds", () => {
  it("copies row ids onto the same positions", () => {
    const next = [{ blockType: "faq", items: [{ question: "q1" }, { question: "q2" }] }];
    const existing = [{ id: "b1", blockType: "faq", items: [{ id: "i1", question: "x" }, { id: "i2", question: "y" }] }];
    expect(withIds(next, existing)).toEqual([{ id: "b1", blockType: "faq", items: [{ id: "i1", question: "q1" }, { id: "i2", question: "q2" }] }]);
  });
  it("leaves rows with no counterpart without an id", () => {
    expect(withIds([{ a: 1 }, { a: 2 }], [{ id: "x" }])).toEqual([{ a: 1, id: "x" }, { a: 2 }]);
  });
});

describe("holds", () => {
  it("is true when everything wanted is there, ignoring ids and extra fields", () => {
    const actual = { title: "T", content: [{ id: "1", blockType: "hero", heading: "H", extra: true }], other: 1 };
    expect(holds(actual, { title: "T", content: [{ blockType: "hero", heading: "H" }] })).toBe(true);
  });
  it("is false on a different value, length or missing field", () => {
    expect(holds({ a: 1 }, { a: 2 })).toBe(false);
    expect(holds({ a: [1, 2] }, { a: [1] })).toBe(false);
    expect(holds({}, { a: "x" })).toBe(false);
  });
  it("compares a populated relationship by its id", () => {
    expect(holds({ image: { id: 5, url: "/x" } }, { image: 5 })).toBe(true);
    expect(holds({ image: 5 }, { image: 5 })).toBe(true);
    expect(holds({ image: 6 }, { image: 5 })).toBe(false);
  });
});

describe("site fields", () => {
  const site = {
    slug: "salon",
    name: "Maison Lune",
    tagline: "Slow beauty",
    theme: "salon",
    primaryColor: "#b4577a",
    logo: "images/logo.svg",
    header: [{ label: "Services", href: "/services", translations: { fr: "Soins" } }],
    footer: { columns: [{ heading: "Visit", translations: { fr: "Visite" }, links: [{ label: "Contact", href: "/contact" }] }] },
    social: [{ platform: "instagram", url: "#" }],
    translations: { fr: { tagline: "Beauté lente" } },
  };

  it("builds the sites collection's fields", () => {
    const fields = siteFields(site, "salon.localhost", ctx);
    expect(fields).toMatchObject({
      name: "Maison Lune",
      domain: "salon.localhost",
      theme: "salon",
      primaryColor: "#b4577a",
      logo: "media:images/logo.svg",
      showDonateButton: false,
      headerNavItems: [{ label: "Services", href: "/services" }],
      footerColumns: [{ heading: "Visit", links: [{ label: "Contact", href: "/contact" }] }],
      socialLinks: [{ platform: "instagram", url: "#" }],
    });
    expect("headingFontFamily" in fields).toBe(false);
  });

  it("builds the translated words of a language", () => {
    expect(siteTranslation(site, "fr")).toEqual({
      tagline: "Beauté lente",
      headerNavItems: [{ label: "Soins", href: "/services" }],
      footerColumns: [{ heading: "Visite", links: [{ label: "Contact", href: "/contact" }] }],
    });
    expect(translatesSite(site, "fr")).toBe(true);
    expect(translatesSite(site, "de")).toBe(false);
  });
});

describe("forms", () => {
  it("builds a form the way the form builder stores it", () => {
    const data = formData(
      {
        key: "booking",
        title: "Book",
        fields: [
          { type: "text", name: "name", label: "Name", required: true },
          { type: "select", name: "service", label: "Service", options: ["Cut", "Colour"] },
          { type: "checkbox", name: "news", label: "News" },
          { type: "message", name: "m", label: "m", message: "Hello" },
        ],
      },
      7,
    );
    expect(data.site).toBe(7);
    expect(data.confirmationType).toBe("message");
    expect(data.fields[0]).toEqual({ blockType: "text", name: "name", label: "Name", required: true });
    expect(data.fields[1].options).toEqual([{ label: "Cut", value: "Cut" }, { label: "Colour", value: "Colour" }]);
    expect(data.fields[3].blockType).toBe("message");
    expect(data.privacy.consentRequired).toBe(false);
  });

  it("lists the form keys the blocks use", () => {
    const site = { pages: [{ blocks: [{ blockType: "formEmbed", form: "a" }, { blockType: "signupForm", form: "b" }, { blockType: "hero" }] }] };
    expect(usedFormKeys(site).sort()).toEqual(["a", "b"]);
  });
});

describe("crossChecks", () => {
  const ok = { pages: [{ slug: "home", blocks: [] }, { slug: "about", blocks: [] }] };

  it("accepts a coherent showcase", () => {
    expect(crossChecks(ok)).toEqual([]);
  });
  it("needs a front page", () => {
    expect(crossChecks({ pages: [{ slug: "about", blocks: [] }] })[0]).toContain("no front page");
  });
  it("catches two pages at one address, including home and /", () => {
    expect(crossChecks({ pages: [{ slug: "home", blocks: [] }, { slug: "/", blocks: [] }] }).join("\n")).toContain("pages[1].slug");
  });
  it("catches a block that points at a missing form", () => {
    const problems = crossChecks({ pages: [{ slug: "home", blocks: [{ blockType: "formEmbed", form: "nope" }] }], forms: [{ key: "other" }] });
    expect(problems).toEqual(['pages[0].blocks[0].form: no form with the key "nope" in forms']);
  });
  it("catches a translation into a language the site does not offer, and into the default one", () => {
    const site = { languages: ["en", "fr"], pages: [{ slug: "home", blocks: [], translations: { de: { title: "x" }, en: { title: "y" } } }] };
    const problems = crossChecks(site);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain("pages[0].translations.de");
  });
  it("catches a default language that is not offered", () => {
    expect(crossChecks({ ...ok, languages: ["en"], defaultLanguage: "fr" })[0]).toContain("defaultLanguage");
  });
});

describe("holds and firstDifference on select values", () => {
  it("treats a number and its text as the same value", () => {
    expect(holds({ columns: "3" }, { columns: 3 })).toBe(true);
    expect(holds({ columns: "4" }, { columns: 3 })).toBe(false);
  });
  it("says where the first difference is", () => {
    expect(firstDifference({ a: [{ b: 1 }] }, { a: [{ b: 2 }] })).toBe("a[0].b: has 1, wanted 2");
    expect(firstDifference({ a: 1 }, { a: 1 })).toBeUndefined();
    expect(firstDifference({ a: [1] }, { a: [1, 2] })).toBe("a: has [1], wanted [1,2]");
  });
});
