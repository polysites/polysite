import type { Block } from "payload";

// A field the visitor never sees. Its value is filled in by the page: where the form
// was (the address, a campaign tag in it, the referrer) or a fixed label. It tells you
// which page or campaign produced each submission, with no cookies or tracking script.
//
// It is NOT spam protection: a visitor's browser can change the value, so the server
// treats it as untrusted text (trimmed, length-limited, never trusted for anything).
// The one exception is "A fixed value", which the server fills in itself and ignores
// whatever the browser sent.

export const HIDDEN_SOURCES = ["page", "param", "referrer", "fixed"] as const;
export type HiddenSource = (typeof HIDDEN_SOURCES)[number];

const NAME = /^[a-z][a-zA-Z0-9_]{0,39}$/;
const PARAM = /^[A-Za-z0-9_.-]{1,40}$/;
const MAX_FIXED = 500;

export const hiddenFieldBlock: Block = {
  slug: "hidden",
  labels: { singular: "Hidden field", plural: "Hidden fields" },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      label: "Name (no spaces)",
      admin: { description: "Starts with a lower-case letter, then letters, digits or underscores, like campaign or source_page." },
      validate: (value: string | null | undefined) => (value && NAME.test(value) ? true : "Start with a lower-case letter, then use only letters, digits and underscores (40 at most)."),
    },
    {
      name: "label",
      type: "text",
      label: "Heading in exports (optional)",
      admin: { description: "Only staff see this. Leave empty to use the name." },
    },
    {
      name: "source",
      type: "select",
      required: true,
      defaultValue: "page",
      options: [
        { label: "The page the form is on (its address without the part after ?)", value: "page" },
        { label: "A value in the page address, like utm_source", value: "param" },
        { label: "Where the visitor came from (the referring page)", value: "referrer" },
        { label: "A fixed value", value: "fixed" },
      ],
    },
    {
      name: "value",
      type: "text",
      label: "Parameter name or fixed value",
      admin: {
        condition: (_, siblingData) => siblingData?.source === "param" || siblingData?.source === "fixed",
        description: "For a value in the page address, the name to look for, like utm_source or ref. For a fixed value, the text to store, like spring-appeal.",
      },
      validate: (value: string | null | undefined, { siblingData }: { siblingData?: { source?: string } }) => {
        const source = siblingData?.source;
        if (source === "param") return value && PARAM.test(value) ? true : "Enter the name to look for: letters, digits, _ . or - (40 at most).";
        if (source === "fixed") return value && value.trim() && value.length <= MAX_FIXED ? true : `Enter the text to store (${MAX_FIXED} characters at most).`;
        return true;
      },
    },
  ],
};
