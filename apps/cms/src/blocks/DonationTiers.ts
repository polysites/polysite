import type { Block } from "payload";

// Homepage's row of suggested donation amounts, extracted as its own block
// for the same reason as SignupForm.ts/LeaderSpotlight.ts.
export const DonationTiers: Block = {
  slug: "donationTiers",
  labels: { singular: "Donation Tiers", plural: "Donation Tiers" },
  fields: [
    { name: "heading", type: "text", required: true },
    {
      name: "amounts",
      type: "array",
      required: true,
      minRows: 1,
      fields: [{ name: "amount", type: "number", required: true, min: 1 }],
    },
    {
      name: "donateHref",
      type: "text",
      defaultValue: "/donate",
      admin: { description: "Link target; ?ask=<amount> is appended per button." },
    },
  ],
};
