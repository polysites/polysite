import type { Block } from "payload";

// Block type: "accordion FAQs".
export const FaqAccordion: Block = {
  slug: "faqAccordion",
  labels: { singular: "FAQ Accordion", plural: "FAQ Accordions" },
  fields: [
    { name: "heading", type: "text" },
    {
      name: "items",
      type: "array",
      required: true,
      minRows: 1,
      fields: [
        { name: "question", type: "text", required: true },
        { name: "answer", type: "textarea", required: true },
      ],
    },
  ],
};
