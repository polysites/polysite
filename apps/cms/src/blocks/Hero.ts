import type { Block } from "payload";

// One of the named block types ("hero banners").
export const Hero: Block = {
  slug: "hero",
  labels: { singular: "Hero Banner", plural: "Hero Banners" },
  fields: [
    { name: "heading", type: "text", required: true },
    { name: "subheading", type: "text" },
    { name: "image", type: "upload", relationTo: "media" },
    { name: "ctaLabel", type: "text" },
    { name: "ctaHref", type: "text" },
  ],
};
