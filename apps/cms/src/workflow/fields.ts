import type { Field } from "payload";

import { hasCapability } from "../access/roles";

// "In review": a marker, not a lock. An editor who may not publish says "this is ready"; the person who can publish sees
// what is waiting (filter the list on it), then publishes it, or sends it back with a note. Publishing clears it.
export const REVIEW_OPTIONS = [
  { label: "Not submitted", value: "none" },
  { label: "Ready for review", value: "in-review" },
  { label: "Changes requested", value: "changes-requested" },
];

export function reviewFields(module: string): Field[] {
  return [
    {
      name: "reviewState",
      type: "select",
      label: "Review",
      defaultValue: "none",
      options: REVIEW_OPTIONS,
      // Hidden from a copy: a duplicate starts unreviewed.
      hooks: { beforeDuplicate: [() => "none"] },
      access: {
        // Editorial markers: not for visitors, who are served the published document.
        read: ({ req: { user } }) => Boolean(user),
        // Anyone who can edit may say a draft is ready; only someone who can publish may send it back.
        update: ({ req: { user }, data }) => data?.reviewState !== "changes-requested" || hasCapability(user, module, "publish"),
      },
      admin: {
        position: "sidebar",
        description: "Ready for review tells whoever publishes that this is waiting for them. Publishing clears it.",
      },
    },
    {
      name: "reviewNote",
      type: "textarea",
      label: "Note for the other person",
      access: { read: ({ req: { user } }) => Boolean(user) },
      admin: {
        position: "sidebar",
        description: "What to look at, or what to change.",
        condition: (data) => Boolean(data?.reviewState) && data.reviewState !== "none",
      },
    },
  ];
}
