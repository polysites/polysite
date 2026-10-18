import type { Access, CollectionConfig, Validate, Where } from "payload";

import { hasCapability } from "../access/roles";
import { normalizeTranslatedSlug } from "../i18n/translatedSlug";
import { uniquePerSite } from "../utils/uniquePerSite";

// Must stay public: anonymous site visitors trigger the frontend's
// redirect lookup (apps/web/composables/usePayloadPage.ts) directly, same
// reasoning as Media's and Pages' published-content read access.
const readAccess: Access = () => true;

const createAccess: Access = ({ req: { user } }) => hasCapability(user, "redirects", "create");
const updateAccess: Access = ({ req: { user } }) => hasCapability(user, "redirects", "update");
const deleteAccess: Access = ({ req: { user } }) => hasCapability(user, "redirects", "delete");

// A Form has no URL of its own (apps/web's FormEmbedBlock only ever renders
// inside a Page) -- every real-world form-builder redirect pattern targets
// the page a form lives on, not the form document itself. `landingPage` on
// Forms (see payload.config.ts's formOverrides) is that explicit link.
// Rejecting the save here means a redirect can never be created pointing at
// a Form that doesn't have one set, rather than silently producing a dead
// link only discovered when a visitor hits it.
const toTargetValidate: Validate = async (value, { req, siblingData }) => {
  // Replaces Payload's own required check (see uniquePerSite.ts), so an internal redirect needs a target here.
  if (!value) return (siblingData as { redirectType?: string } | undefined)?.redirectType === "external" ? true : "Pick the page, file or form to redirect to.";
  if (typeof value !== "object" || value.relationTo !== "forms") return true;
  const formId = typeof value.value === "object" ? value.value?.id : value.value;
  if (!formId) return true;

  const form = await req.payload.findByID({
    collection: "forms",
    id: formId,
    depth: 0,
    overrideAccess: true,
    req, // share the calling request's transaction -- see uniquePerSite.ts's comment
  });

  return !!form?.landingPage || "This form has no landing page set -- add one on the form itself before redirecting to it.";
};

const toUrlValidate: Validate = (value, { siblingData }) => {
  const data = siblingData as { redirectType?: string } | undefined;
  if (data?.redirectType !== "external") return true;
  if (!value) return "An external redirect needs a URL.";
  return /^(https?:\/\/|\/)/.test(value) || 'Must start with "http://", "https://", or "/".';
};

export const Redirects: CollectionConfig = {
  slug: "redirects",
  admin: {
    useAsTitle: "fromPath",
    defaultColumns: ["fromPath", "redirectType", "toTarget", "toUrl", "statusCode", "enabled"],
    group: "URL Manager",
    description:
      "Old or alternate URLs that should send visitors somewhere else. Payload's own server-side redirect -- not a client-side/JS redirect -- so it behaves exactly like a real 301/302 from search engines' and browsers' point of view.",
  },
  access: {
    read: readAccess,
    create: createAccess,
    update: updateAccess,
    delete: deleteAccess,
  },
  fields: [
    // `site` is injected automatically by the multi-tenant plugin (see
    // payload.config.ts) -- not defined here.
    {
      name: "fromPath",
      type: "text",
      required: true,
      // Letters of any script are kept, since a redirect can be from an address in Arabic or French ("fr/à-propos").
      hooks: { beforeValidate: [({ value }) => (typeof value === "string" ? (value.trim() === "/" ? "/" : normalizeTranslatedSlug(value)) : value)] },
      validate: uniquePerSite("redirects", "fromPath"),
      admin: {
        description: "URL path to redirect FROM, e.g. about-old (no leading/trailing slash).",
      },
    },
    {
      name: "redirectType",
      type: "select",
      required: true,
      defaultValue: "internal",
      options: [
        { label: "Internal (page, media, or form)", value: "internal" },
        { label: "External URL", value: "external" },
      ],
    },
    {
      name: "toTarget",
      type: "relationship",
      relationTo: ["pages", "media", "forms"],
      required: true,
      validate: toTargetValidate,
      admin: {
        condition: (data) => data?.redirectType === "internal",
        description: "A Form target redirects to that form's landing page, not the form itself.",
      },
      filterOptions: ({ relationTo, data }) => {
        const siteId = typeof data?.site === "object" ? data.site?.id : data?.site;
        if (!siteId) return true;
        // Forms aren't site-scoped (no `site` field of their own) -- scope
        // via the Page they're set to land on instead, so only forms
        // actually tied to this redirect's own site are selectable.
        return (relationTo === "forms" ? { "landingPage.site": { equals: siteId } } : { site: { equals: siteId } }) as Where;
      },
    },
    {
      name: "toUrl",
      type: "text",
      required: true,
      validate: toUrlValidate,
      admin: {
        condition: (data) => data?.redirectType === "external",
        description: "Full URL, e.g. https://example.com/page",
      },
    },
    {
      name: "statusCode",
      type: "select",
      required: true,
      defaultValue: "301",
      options: [
        { label: "301 - Permanent", value: "301" },
        { label: "302 - Temporary", value: "302" },
      ],
    },
    {
      name: "enabled",
      type: "checkbox",
      defaultValue: true,
    },
    {
      name: "notes",
      type: "textarea",
      admin: {
        description: "Freeform notes -- auto-filled when Payload creates this automatically after a page slug change.",
      },
    },
  ],
};
