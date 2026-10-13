import type { Block } from "payload";

// A compact email sign-up box, reusable anywhere on a page. It is a layout over a
// Form from the form builder: the form decides which fields exist and where the
// answers go, this block decides how the box looks and what it says.
export const SignupForm: Block = {
  slug: "signupForm",
  labels: { singular: "Signup Form", plural: "Signup Forms" },
  fields: [
    { name: "heading", type: "text", required: true },
    { name: "subheading", type: "textarea" },
    {
      name: "form",
      type: "relationship",
      relationTo: "forms",
      admin: {
        description:
          "The form this box submits to. Create one under Forms (for example an email and postal code). Until one is chosen the box shows nothing to visitors.",
      },
    },
    { name: "ctaLabel", type: "text", defaultValue: "Join Now", admin: { description: "Button text. Overrides the form's own button label." } },
  ],
};
