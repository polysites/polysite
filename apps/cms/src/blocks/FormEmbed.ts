import type { Block } from "payload";

// Block type: "form embeds". Real relationship to plugin-form-builder's
// `forms` collection -- the frontend rendering itself (FormEmbedBlock.vue)
// is still a placeholder, but the data link is real.
export const FormEmbed: Block = {
  slug: "formEmbed",
  labels: { singular: "Form Embed", plural: "Form Embeds" },
  fields: [
    { name: "heading", type: "text" },
    {
      name: "form",
      type: "relationship",
      relationTo: "forms",
    },
  ],
};
