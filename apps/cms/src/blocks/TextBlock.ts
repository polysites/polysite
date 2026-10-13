import { convertLexicalToHTMLAsync } from "@payloadcms/richtext-lexical/html-async";
import type { Block } from "payload";

// Block type: "text blocks".
export const TextBlockConfig: Block = {
  slug: "textBlock",
  labels: { singular: "Text Block", plural: "Text Blocks" },
  fields: [
    { name: "heading", type: "text" },
    { name: "body", type: "richText" },
    {
      // Computed on read, not stored -- the frontend renders this directly
      // via v-html instead of walking the Lexical AST itself (there's no
      // Vue-compatible renderer for it; Payload's own is React-only). Hidden
      // from the admin form since editors only ever touch `body`.
      name: "bodyHTML",
      type: "text",
      virtual: true,
      admin: { hidden: true },
      hooks: {
        afterRead: [
          async ({ siblingData }) => {
            if (!siblingData?.body) return "";
            return convertLexicalToHTMLAsync({
              data: siblingData.body,
              disableContainer: true,
            });
          },
        ],
      },
    },
  ],
};
