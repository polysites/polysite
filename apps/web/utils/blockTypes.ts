// Block types a plugin adds to the page builder (the CMS side adds them to Pages.content; this is the public site's half).
//
// A plugin's web layer registers each block from its own Nuxt plugin (`dependsOn: ["block-types"]`):
//
//   nuxtApp.$blockTypes.register({ slug: "gallery", name: "GalleryBlock", component: GalleryBlock });
//
// `name` is what a theme calls its own version of the block (a theme's components/<theme>/GalleryBlock.vue overrides it, and a
// parent theme's is inherited), exactly as for the core's blocks (utils/resolveBlock.ts). `component` is the plain fallback used
// when no theme supplies one. With no plugin installed nothing is registered and the core's blocks are unchanged.
import { markRaw, type Component } from "vue";

export interface BlockType {
  /** The block's slug in Payload (`blockType` in the page data). */
  slug: string;
  /** The component base name a theme overrides, like "GalleryBlock". */
  name: string;
  /** The plugin's own plain version, drawn when the site's theme (and its parents) have none. */
  component: Component;
}

export interface BlockTypes {
  /** Adds a block type. A slug that is registered twice keeps the first. */
  register(type: BlockType): void;
  /** slug -> component base name, for the renderer to merge with the core's. */
  names(): Record<string, string>;
  /** slug -> fallback component. */
  fallbacks(): Record<string, Component>;
}

export function createBlockTypes(): BlockTypes {
  const types = new Map<string, BlockType>();
  return {
    register(type) {
      if (types.has(type.slug)) return;
      types.set(type.slug, { ...type, component: markRaw(type.component) });
    },
    names: () => Object.fromEntries([...types.values()].map((t) => [t.slug, t.name])),
    fallbacks: () => Object.fromEntries([...types.values()].map((t) => [t.slug, t.component])),
  };
}
