import type { Block } from "payload";

// Block type: "feature grids".
export const FeatureGrid: Block = {
  slug: "featureGrid",
  labels: { singular: "Feature Grid", plural: "Feature Grids" },
  fields: [
    { name: "heading", type: "text" },
    {
      name: "features",
      type: "array",
      required: true,
      minRows: 1,
      fields: [
        { name: "title", type: "text", required: true },
        { name: "description", type: "textarea" },
      ],
    },
  ],
};
