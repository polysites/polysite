import type { Block } from "payload";

// Was a marker block pointing at a separate, site-scoped Commitments
// collection -- moved to inline items (matching FeatureGrid's shape) per
// the user's call: this is really just a list of cards with a
// heading/body/optional link button, not data that needed its own
// collection, its own admin nav entry, or its own RBAC surface. Editors
// add/remove/reorder cards directly in this block now, same as any other
// array field.
export const CommitmentsGrid: Block = {
  slug: "commitmentsGrid",
  labels: { singular: "Commitments Grid", plural: "Commitments Grids" },
  fields: [
    { name: "heading", type: "text", required: true },
    {
      name: "items",
      type: "array",
      required: true,
      minRows: 1,
      fields: [
        { name: "heading", type: "text", required: true },
        { name: "body", type: "textarea" },
        { name: "ctaLabel", type: "text" },
        { name: "ctaHref", type: "text" },
      ],
    },
  ],
};
