import type { Access, CollectionConfig, Endpoint, PayloadRequest, Where } from "payload";
import { trace } from "@opentelemetry/api";

import { hasCapability, isSuperAdmin, userSiteIds } from "../access/roles";
import { nextFreeCopySlug, normalizeSlug } from "../utils/slug";
import { localizeNamed } from "../i18n/localize";
import { uniquePerSite } from "../utils/uniquePerSite";
import { reviewFields } from "../workflow/fields";
import { liveBefore, publishAware, publishRules } from "../workflow/hooks";
import { changesLiveSite, isDraftRequest, slugToRedirectFrom } from "../workflow/rules";
import { Hero } from "../blocks/Hero";
import { TextBlockConfig } from "../blocks/TextBlock";
import { FaqAccordion } from "../blocks/FaqAccordion";
import { FeatureGrid } from "../blocks/FeatureGrid";
import { FormEmbed } from "../blocks/FormEmbed";
import { SignupForm } from "../blocks/SignupForm";
import { LeaderSpotlight } from "../blocks/LeaderSpotlight";
import { DonationTiers } from "../blocks/DonationTiers";
import { CommitmentsGrid } from "../blocks/CommitmentsGrid";

// Which SITES a non-admin can reach is the multi-tenant plugin's job
// (payload.config.ts's multiTenantPlugin, `useTenantAccess: true` default) --
// it ANDs a `{ site: { in: <user's assigned sites> } }` constraint onto
// whatever these functions return, and skips that entirely for Super Admins
// via `userHasAccessToAllTenants`. What's left here is the RBAC capability
// check plus the one business rule the plugin doesn't know about:
// draft/published visibility. A role without pages:read only ever sees
// published pages (`_status`, Payload's own draft field), same as an anonymous visitor -- not "any authenticated
// user sees every draft," which was the old, looser behavior.
const readAccess: Access = ({ req: { user } }) => {
  if (hasCapability(user, "pages", "read")) return true;
  return { _status: { equals: "published" } } as Where;
};

const createAccess: Access = ({ req: { user } }) => hasCapability(user, "pages", "create");
const updateAccess: Access = publishAware("pages", ({ req: { user } }) => hasCapability(user, "pages", "update"));
const deleteAccess: Access = ({ req: { user } }) => hasCapability(user, "pages", "delete");

// Publish and unpublish are separate capabilities, so each direction is checked on its own. A draft saved over a live page
// is neither: the live page keeps its published version (see the content workflow notes in docs/ARCHITECTURE.md).
// Recursively drops every `id` key from a copied blocks/array-field
// structure -- see the cloneToSite handler below for why this matters.
function stripIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripIds);
  if (value && typeof value === "object") {
    const { id: _id, ...rest } = value as Record<string, unknown>;
    return Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, stripIds(v)]));
  }
  return value;
}

// Copies a Page to a different Site the acting user has access to. Payload's
// built-in Duplicate only ever copies within the same Site (it re-saves the
// same document's field values verbatim, `site` included) -- this is a
// custom endpoint precisely because that gap has no built-in equivalent.
// Enforced server-side, not just hidden in the admin UI: both the
// cloneAcrossSites capability and the target site's membership are checked
// here regardless of what any client sends, since a client-side-only
// restriction isn't a real restriction. The clone always lands as a draft
// on the destination site regardless of the source's own status -- standard
// content-staging safety default, so cloning never silently publishes
// something live on a site nobody reviewed it for yet.
const cloneToSite: Endpoint = {
  path: "/:id/clone",
  method: "post",
  handler: async (req: PayloadRequest) => {
    const { user, payload, routeParams } = req;
    const id = routeParams?.id as string | undefined;
    if (!id) return Response.json({ error: "Missing page id" }, { status: 400 });

    if (!hasCapability(user, "pages", "cloneAcrossSites")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json?.()) as { targetSiteId?: string | number } | undefined;
    const targetSiteId = body?.targetSiteId;
    if (!targetSiteId) return Response.json({ error: "Missing targetSiteId" }, { status: 400 });

    if (!isSuperAdmin(user) && !userSiteIds(user).map(String).includes(String(targetSiteId))) {
      return Response.json({ error: "Forbidden: target site not accessible" }, { status: 403 });
    }

    // Read as the caller, not as the server: the site scoping and draft rules of the pages collection then apply, so the
    // source has to be a page the caller can open. (Reading it with the server's access let any editor copy, and so
    // read, an unpublished page of a site they have no part in just by guessing its id.)
    const source = await payload.findByID({ collection: "pages", id, depth: 0, user, overrideAccess: false }).catch(() => null);
    if (!source) return Response.json({ error: "Page not found" }, { status: 404 });

    let slug = source.slug;
    const collision = await payload.find({
      collection: "pages",
      where: { and: [{ slug: { equals: slug } }, { site: { equals: targetSiteId } }] },
      limit: 1,
      overrideAccess: true,
    });
    if (collision.totalDocs > 0) slug = `${slug}-copy`;

    const cloned = await payload.create({
      collection: "pages",
      data: {
        title: source.title,
        slug,
        site: Number(targetSiteId),
        _status: "draft",
        // Every block, and every array-field row within a block (e.g.
        // commitmentsGrid.items), carries its own `id` -- a real primary key
        // in its own Postgres table, not scoped per-parent-document.
        // Copying those ids verbatim collides with the source page's own
        // rows ("Value must be unique" on id, hit for real while building
        // this). Stripping every `id` recursively lets Payload assign fresh
        // ones for the clone, same as if an editor had built it from scratch.
        // stripIds only ever removes `id` keys (already optional on every
        // block type below) -- same shape in, same shape out.
        content: stripIds(source.content) as typeof source.content,
      },
      overrideAccess: true,
    });

    return Response.json({ doc: cloned });
  },
};

const pagesBase: CollectionConfig = {
  slug: "pages",
  admin: {
    useAsTitle: "title",
    // `rowActions` is a UI-only column (no data): the three-dot menu on each
    // list row -- see components/PageRowActions.
    defaultColumns: ["title", "slug", "frontLink", "_status", "reviewState", "updatedAt", "rowActions"],
    // Consumed by the custom Nav (components/AdminNav) via Payload's own
    // groupNavItems() -- real permission-filtered grouping, not a
    // hand-rolled second capability check duplicating access/roles.ts.
    group: "Content",
    // Same 3-dot-menu slot @payloadcms/plugin-multi-tenant uses for its own
    // "Assign Tenant" action -- the button itself checks nothing (the real
    // enforcement is server-side, in the cloneToSite endpoint above); a user
    // without pages:cloneAcrossSites just gets a 403 from the endpoint if
    // they somehow trigger it, same as any other capability check here.
    components: {
      edit: {
        editMenuItems: ["/components/CloneToSiteButton#CloneToSiteButton"],
      },
    },
  },
  access: {
    read: readAccess,
    create: createAccess,
    update: updateAccess,
    delete: deleteAccess,
    // Payload's default is "any signed-in user", which would show the drafts of the caller's sites to a role that cannot read pages.
    readVersions: ({ req: { user } }) => hasCapability(user, "pages", "read"),
  },
  // The list view only loads the fields of its visible columns, but the
  // Front-end Link cell is built from `site` (not a column) and `slug`.
  forceSelect: { site: true, slug: true },
  endpoints: [cloneToSite],
  // Drafts, version history with restore, and scheduled publish/unpublish are Payload's own machinery. Autosave is off:
  // editors press "Save draft" or "Publish changes" on purpose, and a flood of autosaved versions helps nobody.
  versions: { maxPerDoc: 25, drafts: { autosave: false, schedulePublish: true, validate: false } },
  fields: [
    // `site` is injected automatically by the multi-tenant plugin (see
    // payload.config.ts) -- not defined here.
    {
      name: "title",
      type: "text",
      required: true,
      // Payload's duplicate keeps every field as-is; "(Copy)" makes the new
      // row recognisable in the list.
      hooks: { beforeDuplicate: [({ value }) => (typeof value === "string" && value ? `${value} (Copy)` : value)] },
    },
    {
      name: "slug",
      type: "text",
      required: true,
      hooks: {
        beforeValidate: [({ value }) => (typeof value === "string" ? normalizeSlug(value) : value)],
        // A straight copy keeps the same slug, which the per-site uniqueness
        // rule rejects ("The following field is invalid: Slug") -- so
        // Duplicate used to fail on every page. Pick the next free
        // "<slug>-copy[-N]" on the same site instead.
        beforeDuplicate: [
          async ({ value, siblingData, req }) => {
            if (typeof value !== "string") return value;
            const ref = siblingData?.site;
            const siteId = ref && typeof ref === "object" ? (ref as { id?: unknown }).id : ref;
            return nextFreeCopySlug(value, async (candidate) => {
              const found = await req.payload.find({
                collection: "pages",
                where: { and: [{ slug: { equals: candidate } }, ...(siteId ? [{ site: { equals: siteId } }] : [])] },
                limit: 1,
                depth: 0,
                overrideAccess: true,
                req,
              });
              return found.totalDocs > 0;
            });
          },
        ],
      },
      validate: uniquePerSite("pages", "slug"),
      admin: {
        description: "URL path within the site, e.g. about-us",
      },
    },
    {
      // Computed, not stored: the site's domain + this page's slug. A typed
      // value would duplicate those two, go stale on every slug change, and
      // (as `required`) hang the dev schema push on existing rows.
      name: "frontLink",
      type: "ui",
      label: "Front-end Link",
      admin: {
        components: {
          Cell: "/components/FrontLink#FrontLinkCell",
          Field: "/components/FrontLink#FrontLinkField",
        },
      },
    },
    ...reviewFields("pages"),
    {
      // Legacy. Before drafts were native, this held draft/published. It is kept (hidden, unused) so that no column is
      // dropped and the migration can copy it into `_status`; a later release can remove it.
      name: "status",
      type: "select",
      hidden: true,
      admin: { hidden: true },
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
      ],
    },
    {
      // No data: only a list-view cell (the three-dot menu on each row).
      name: "rowActions",
      type: "ui",
      label: "",
      admin: {
        components: { Cell: "/components/PageRowActions#PageRowActions" },
      },
    },
    {
      // The product requirements' "drag-and-drop page constructor built from pre-defined UI
      // blocks" requirement — Payload's native `blocks` field type: editors
      // add/remove/reorder typed sections in the admin form. Not a
      // free-position visual canvas (no drag-positioning on a live page
      // preview); paired with Live Preview below for the "see the real
      // page while editing" half of that requirement instead.
      name: "content",
      type: "blocks",
      blocks: [
        Hero,
        TextBlockConfig,
        FaqAccordion,
        FeatureGrid,
        FormEmbed,
        SignupForm,
        LeaderSpotlight,
        DonationTiers,
        CommitmentsGrid,
      ],
    },
  ],
  hooks: {
    // Records the live version and enforces publish / unpublish permission (workflow/hooks.ts).
    beforeChange: [publishRules("pages", "pages")],
    afterChange: [
      async ({ req }) => {
        // Only the live version matters to visitors, so saving a draft never refreshes the public site.
        if (!changesLiveSite({ isDraftSave: isDraftRequest(req.query) })) return;

        const url = process.env.NUXT_REVALIDATE_URL;
        if (!url) return;

        try {
          await fetch(url, {
            method: "POST",
            headers: { "x-revalidate-secret": process.env.REVALIDATE_SECRET || "" },
          });
        } catch (err) {
          // Non-fatal: the page save still succeeds even if the cache purge
          // fails, and the isr route rule's own TTL will catch up eventually.
          // recordException is a no-op when OTel isn't enabled (no active
          // span) -- see instrumentation.ts -- so this is safe either way.
          console.error("Failed to trigger frontend revalidation", err);
          trace.getActiveSpan()?.recordException(err as Error);
        }
      },
      // Renaming a published page's slug would otherwise silently 404 its
      // old URL (usePayloadPage has no fallback once a page lookup misses).
      // Auto-creates/updates a Redirects doc from the OLD slug to this page
      // so that can never happen by accident. Find-then-update (not a bare
      // create) so renaming the same page twice doesn't pile up duplicate
      // redirect rows pointing at the same target. Non-fatal on error, same
      // reasoning as the revalidation hook above -- a redirect failing to
      // auto-create must never block the page save itself.
      async ({ doc, operation, req }) => {
        if (operation !== "update") return;
        // The address that needs a redirect is the old LIVE one, and only when this save changes what is live: a draft with
        // a new slug changes nothing for visitors yet, and the previous draft may already carry the new slug.
        const oldSlug = slugToRedirectFrom({
          isDraftSave: isDraftRequest(req.query),
          liveSlugBefore: liveBefore(req)?.slug,
          slugAfter: doc.slug,
        });
        if (!oldSlug) return;

        const siteId = typeof doc.site === "object" ? doc.site?.id : doc.site;
        if (!siteId) return;

        try {
          // `req` passed through on every call below: shares the current
          // save's own transaction instead of opening a second one. Skipping
          // this deadlocked for real -- inserting into redirects_rels (an FK
          // back to this very page) from a SEPARATE transaction had to wait
          // for this still-open outer transaction to commit, while the outer
          // transaction was itself waiting on this afterChange hook to
          // finish first. Confirmed by a stuck ~65s+ save and a genuinely
          // orphaned "idle in transaction" Postgres session, not a guess.
          const existing = await req.payload.find({
            collection: "redirects",
            where: { and: [{ fromPath: { equals: oldSlug } }, { site: { equals: siteId } }] },
            limit: 1,
            overrideAccess: true,
            req,
          });

          const data = {
            fromPath: oldSlug,
            redirectType: "internal" as const,
            toTarget: { relationTo: "pages" as const, value: doc.id },
            statusCode: "301" as const,
            enabled: true,
            notes: "Auto-created when this page's slug changed.",
            site: siteId,
          };

          if (existing.docs[0]) {
            await req.payload.update({ collection: "redirects", id: existing.docs[0].id, data, overrideAccess: true, req });
          } else {
            await req.payload.create({ collection: "redirects", data, overrideAccess: true, req });
          }
        } catch (err) {
          console.error("Failed to auto-create redirect for changed page slug", err);
          trace.getActiveSpan()?.recordException(err as Error);
        }
      },
    ],
  },
};

// Every language of a page shares its address, the order of its blocks and its pictures; the title and the text inside the blocks
// are what gets translated (i18n/localize.ts). With one language this changes nothing visible.
export const Pages: CollectionConfig = { ...pagesBase, fields: localizeNamed(pagesBase.fields, ["title", "content"]) };
