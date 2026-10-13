import type { Block } from "payload";

// Homepage's leader photo/quote section, extracted as its own block for the
// same reason as SignupForm.ts -- was hardcoded into the theme's bespoke
// index.vue, now editable in the CMS like any other page content.
export const LeaderSpotlight: Block = {
  slug: "leaderSpotlight",
  labels: { singular: "Leader Spotlight", plural: "Leader Spotlights" },
  fields: [
    { name: "photo", type: "upload", relationTo: "media" },
    { name: "name", type: "text", required: true },
    { name: "title", type: "text" },
    { name: "quote", type: "textarea", required: true },
    { name: "ctaLabel", type: "text" },
    { name: "ctaHref", type: "text" },
  ],
};
