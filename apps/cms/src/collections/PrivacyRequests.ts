import type { CollectionConfig } from "payload";

import { hasCapability } from "../access/roles";

// A register of requests from people about their personal information: to see
// it, correct it, withdraw consent, or have it erased. Privacy law expects an
// organization to answer these within a set time (30 days under PIPEDA) and to
// be able to show that it did, so each request is a record with a deadline and
// a status, per site.
//
// The actions (find, export, erase) are buttons on the edit page (components/
// PrivacyActions) backed by privacy/endpoints.ts. Erasing keeps an HMAC of the
// person's email, not the email, so a restore from an older backup can be
// followed by re-applying every erasure (scripts/reapplyErasures.ts).

const DAY_MS = 24 * 60 * 60 * 1000;
export const RESPONSE_DEADLINE_DAYS = 30;

export const PrivacyRequests: CollectionConfig = {
  slug: "privacy-requests",
  labels: { singular: "Privacy Request", plural: "Privacy Requests" },
  admin: {
    group: "Administration",
    useAsTitle: "requesterEmail",
    defaultColumns: ["requesterEmail", "type", "status", "dueAt", "site"],
    description:
      "Requests from people to see, correct, or delete the personal information you hold about them. Log each one here and work it from its page.",
  },
  access: {
    create: ({ req: { user } }) => hasCapability(user, "privacy-requests", "create"),
    read: ({ req: { user } }) => hasCapability(user, "privacy-requests", "read"),
    update: ({ req: { user } }) => hasCapability(user, "privacy-requests", "update"),
    delete: ({ req: { user } }) => hasCapability(user, "privacy-requests", "delete"),
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data;
        if (typeof data.requesterEmail === "string") data.requesterEmail = data.requesterEmail.trim().toLowerCase();
        if (!data.receivedAt) data.receivedAt = new Date().toISOString();
        if (!data.dueAt) data.dueAt = new Date(new Date(data.receivedAt).getTime() + RESPONSE_DEADLINE_DAYS * DAY_MS).toISOString();
        return data;
      },
    ],
  },
  fields: [
    {
      name: "type",
      type: "select",
      required: true,
      defaultValue: "access",
      options: [
        { label: "Access: send them a copy of their information", value: "access" },
        { label: "Erasure: delete their information", value: "erasure" },
        { label: "Withdraw consent: stop using it and delete it", value: "withdraw-consent" },
        { label: "Correction", value: "correction" },
        { label: "Complaint or other", value: "other" },
      ],
    },
    {
      name: "requesterEmail",
      type: "email",
      admin: {
        description:
          "The email address the person used when they gave their information. Cleared automatically once an erasure is done.",
      },
    },
    { name: "receivedAt", type: "date", admin: { date: { pickerAppearance: "dayOnly" }, description: "Defaults to now." } },
    {
      name: "dueAt",
      type: "date",
      admin: {
        date: { pickerAppearance: "dayOnly" },
        description: `Defaults to ${RESPONSE_DEADLINE_DAYS} days after it was received, the usual legal deadline. Check the rule that applies to you.`,
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "received",
      options: [
        { label: "Received", value: "received" },
        { label: "In progress", value: "in-progress" },
        { label: "Completed", value: "completed" },
        { label: "Refused or not applicable", value: "refused" },
      ],
    },
    { name: "completedAt", type: "date", admin: { readOnly: true, date: { pickerAppearance: "dayAndTime" } } },
    { name: "recordsFound", type: "number", admin: { readOnly: true, description: "How many form submissions matched the email when last searched." } },
    {
      name: "subjectHash",
      type: "text",
      admin: { readOnly: true, description: "A one-way fingerprint of the email, kept after an erasure so it can be re-applied after a restore." },
    },
    {
      name: "notes",
      type: "textarea",
      admin: { description: "What you did and why, for your records. Don't paste the person's information here." },
    },
    {
      name: "actions",
      type: "ui",
      admin: { components: { Field: "/components/PrivacyActions#PrivacyActions" } },
    },
  ],
};
