import { describe, expect, it } from "vitest";

import { createBlockTypes } from "./blockTypes";
import { BLOCK_COMPONENT_NAMES, resolveBlockComponent } from "./resolveBlock";

describe("block types a plugin registers", () => {
  it("starts empty, so the core's blocks are unchanged", () => {
    const types = createBlockTypes();
    expect(types.names()).toEqual({});
    expect(types.fallbacks()).toEqual({});
  });

  it("lists each block's name and fallback component by slug", () => {
    const types = createBlockTypes();
    const gallery = { render: () => null };
    types.register({ slug: "gallery", name: "GalleryBlock", component: gallery });
    types.register({ slug: "price-list", name: "PriceListBlock", component: gallery });
    expect(types.names()).toEqual({ gallery: "GalleryBlock", "price-list": "PriceListBlock" });
    expect(types.fallbacks().gallery).toBe(gallery);
  });

  it("keeps the first registration of a slug", () => {
    const types = createBlockTypes();
    types.register({ slug: "gallery", name: "GalleryBlock", component: { render: () => "first" } });
    types.register({ slug: "gallery", name: "OtherBlock", component: { render: () => "second" } });
    expect(types.names()).toEqual({ gallery: "GalleryBlock" });
  });

  it("resolves like a core block: a theme's version first, then its parent's, then the plugin's", () => {
    const types = createBlockTypes();
    types.register({ slug: "gallery", name: "GalleryBlock", component: "plugin-gallery" as never });
    const names = { ...BLOCK_COMPONENT_NAMES, ...types.names() };
    const fallbacks = { ...types.fallbacks() };
    expect(resolveBlockComponent("gallery", ["acme", "starter"], { AcmeGalleryBlock: "acme" }, fallbacks, names)).toBe("acme");
    expect(resolveBlockComponent("gallery", ["acme", "starter"], { StarterGalleryBlock: "starter" }, fallbacks, names)).toBe("starter");
    expect(resolveBlockComponent("gallery", ["acme"], {}, fallbacks, names)).toBe("plugin-gallery");
  });

  it("an unregistered plugin block stays unknown (the page says so rather than drawing nothing)", () => {
    expect(resolveBlockComponent("gallery", ["acme"], { AcmeGalleryBlock: "acme" }, {})).toBeUndefined();
  });

  it("a plugin cannot take over a core block's component name", () => {
    const types = createBlockTypes();
    types.register({ slug: "hero", name: "EvilHero", component: "x" as never });
    const merged = { ...types.names(), ...BLOCK_COMPONENT_NAMES };
    expect(merged.hero).toBe("HeroBlock");
  });
});

describe("block types are looked up by their own name only", () => {
  it("a block type named like an object property is unknown, not a function from the prototype", () => {
    for (const odd of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(resolveBlockComponent(odd, ["acme"], {}, {})).toBeUndefined();
    }
  });
});
