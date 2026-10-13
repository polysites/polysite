import { describe, expect, it } from "vitest";

import { pascalCase, resolveBlockComponent, themeChain } from "./resolveBlock";

describe("pascalCase", () => {
  it("capitalizes a single word", () => {
    expect(pascalCase("starter")).toBe("Starter");
  });

  it("joins hyphenated and underscored names", () => {
    expect(pascalCase("my-cool_theme")).toBe("MyCoolTheme");
  });
});

describe("themeChain", () => {
  it("is empty when the site has no theme", () => {
    expect(themeChain(undefined)).toEqual([]);
  });

  it("walks parents nearest first", () => {
    expect(themeChain("acme", { acme: "starter" })).toEqual(["acme", "starter"]);
  });

  it("stops on a parent loop instead of spinning", () => {
    expect(themeChain("a", { a: "b", b: "a" })).toEqual(["a", "b"]);
  });
});

describe("resolveBlockComponent", () => {
  const fallbacks = { hero: "core-hero", textBlock: "core-text" };

  it("prefers the site's theme over everything else", () => {
    const registry = { AcmeHeroBlock: "acme-hero", StarterHeroBlock: "starter-hero" };
    expect(resolveBlockComponent("hero", ["acme", "starter"], registry, fallbacks)).toBe("acme-hero");
  });

  it("falls back to the parent theme for a block the theme doesn't override", () => {
    const registry = { StarterTextBlock: "starter-text" };
    expect(resolveBlockComponent("textBlock", ["acme", "starter"], registry, fallbacks)).toBe("starter-text");
  });

  it("falls back to the core component when no theme provides the block", () => {
    expect(resolveBlockComponent("hero", ["acme"], {}, fallbacks)).toBe("core-hero");
  });

  it("does not leak one site's theme into another's", () => {
    const registry = { AcmeHeroBlock: "acme-hero" };
    expect(resolveBlockComponent("hero", ["bakery"], registry, fallbacks)).toBe("core-hero");
  });

  it("returns undefined for a block type nobody has heard of", () => {
    expect(resolveBlockComponent("mystery", ["starter"], {}, fallbacks)).toBeUndefined();
  });
});
