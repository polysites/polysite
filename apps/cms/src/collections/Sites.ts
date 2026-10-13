import { validateLinkUrl } from "../utils/safeUrl";
import { type Access, type CollectionConfig, ValidationError, type Where } from "payload";
import fs from "fs";
import path from "path";

import { canManageSiteSettings, isSuperAdmin, userSiteIds } from "../access/roles";
import { decrypt, encrypt, SECRET_MASK } from "../forms/secrets";
import { translatable } from "../i18n/localize";
import { RBAC_MODULES } from "../rbac/modules";

const KEY = /^[A-Za-z0-9_-]{10,200}$/;
const canSeeKeys = ({ req: { user } }: { req: { user?: unknown } }) => isSuperAdmin(user as never) || canManageSiteSettings(user as never);

// WordPress-style theme auto-discovery: scans themes/ for
// valid theme packages instead of a hand-maintained options list. A
// directory `themes/polysite-theme-<value>/` counts as a valid theme when
// it has BOTH a `layouts/<value>.vue` (proves it's actually wired up to
// render, matching the naming convention every theme's layout already
// follows) and a `theme.json` with a display label (the WordPress
// `style.css` header equivalent -- a plain directory name isn't a nice
// label on its own). Drop in a new theme folder with both present and it
// appears here with no code change; apps/web/nuxt.config.ts runs the same
// scan independently to build its `extends` array.
//
// Runs once when this config loads (container boot / dev restart), not
// per-request -- Payload evaluates field config at startup, same as any
// other field property here.
function discoverThemes(): { label: string; value: string }[] {
  const themesDir = path.resolve(process.cwd(), "../../themes");
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(themesDir, { withFileTypes: true });
  } catch {
    // themes/ not mounted into this container, or no client theme repos
    // exist yet -- fall back to the platform's own generic theme rather
    // than a specific client's name. Never leave the dropdown with zero
    // options over it.
    return [{ label: "Default", value: "default" }];
  }

  const themes: { label: string; value: string }[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(/^polysite-theme-(.+)$/);
    if (!match) continue;
    const value = match[1];

    const layoutPath = path.join(themesDir, entry.name, "layouts", `${value}.vue`);
    if (!fs.existsSync(layoutPath)) continue; // no matching layout -- not a valid theme

    let label = value;
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(themesDir, entry.name, "theme.json"), "utf-8"));
      if (typeof meta.label === "string" && meta.label) label = meta.label;
    } catch {
      // no theme.json, or it's unparsable -- fall back to the raw value
    }

    themes.push({ label, value });
  }

  return themes.length > 0 ? themes.sort((a, b) => a.value.localeCompare(b.value)) : [{ label: "Default", value: "default" }];
}

export const THEMES = discoverThemes();
// The starter when it is installed, otherwise whichever theme sorts first.
const DEFAULT_THEME = THEMES.find((t) => t.value === "starter")?.value ?? THEMES[0]?.value ?? "default";

// Omitting `read` entirely defaults to Payload's built-in `() => true` --
// fully public, no auth required. Caught for real: every Content Editor and
// Campaign Manager could list every client's Sites record regardless of
// assignedSites, the exact "editors assigned to Site A cannot see... assets
// belonging to Site B" leak the product requirements call out. Fixed for authenticated
// non-admins by scoping to assignedSites -- but anonymous stays public
// (`true`, not `false`): the public frontend resolves which Site a request
// belongs to by querying Pages with a `site.domain` relationship filter
// (usePayloadPage), and Payload's query-path validator requires read access
// on the *joined* collection for that to work at all, not just on Pages
// itself -- confirmed for real, this exact join threw "cannot be queried:
// domain" once anonymous read here was `false`. `name`/`domain` aren't
// sensitive (`domain` is the public URL itself); the real leak this fixes is
// cross-site visibility between authenticated editors, not public visibility
// of a site's own name/domain.
//
// A Site User (manageSiteSettings: false) still needs this scoped-but-non-
// `false` read result, same as a Site Admin -- the multi-tenant plugin's own
// tenant-resolution/scoping for Pages/Media etc. depends on being able to
// read at least their own assigned Sites regardless of manageSiteSettings;
// gating this to canManageSiteSettings was tried and broke the ENTIRE admin
// root layout for every non-managing role (a hard 500 "Forbidden", not just
// a hidden nav item) the moment it was tested against a real Site User
// login, confirming that dependency for real rather than assuming it away.
// "Sites" still shows in a Site User's nav as a result of this -- that's a
// nav-visibility question, not a data-access one, and belongs on
// `admin.hidden` below instead of on this access function.
const readAccess: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user)) return true;
  if (user) return { id: { in: userSiteIds(user) } } as Where;
  return true;
};

// Provisioning/removing a site stays Super-Admin-only regardless of role --
// high blast-radius, not delegated even to a role with manageSiteSettings.
// Editing an EXISTING site's own settings is delegated: a role with
// manageSiteSettings (Site Admin, per rbac/seedRoles.ts's defaults) can
// update a site it's assigned to, checked against a specific document's `id`
// when one is present (an edit) and against a `Where` filter otherwise (the
// admin list view) -- same two-shape pattern readAccess above already uses.
const updateAccess: Access = ({ req: { user }, id }) => {
  if (isSuperAdmin(user)) return true;
  if (!canManageSiteSettings(user)) return false;
  if (id) return userSiteIds(user).map(String).includes(String(id));
  return { id: { in: userSiteIds(user) } } as Where;
};

// One row per client site. `domain` is what Caddy and the Nuxt frontend use
// to resolve which site a request belongs to. Adding a new client site is a
// new row here plus a Caddy config entry — not new infrastructure (see the
// the product requirements' deployment section).
//
// Also doubles as the multi-tenant plugin's "tenants" collection
// (payload.config.ts's multiTenantPlugin `tenantsSlug: "sites"`) -- kept the
// existing slug/name rather than renaming to `tenants`, so this collection's
// own access control (below) stays authoritative (the plugin is configured
// with `useTenantsCollectionAccess: false`) and the frontend's `site.domain`
// queries needed zero changes.
export const Sites: CollectionConfig = {
  slug: "sites",
  admin: {
    useAsTitle: "name",
    group: "Administration",
    // Separate from `access.read` above on purpose: a Site User's scoped
    // read access has to stay (the multi-tenant plugin's own tenant
    // resolution needs it, confirmed by testing -- see readAccess's
    // comment), but they still shouldn't see "Sites" as a manageable
    // Administration item since they have no manageSiteSettings capability
    // and no write access here at all. `admin.hidden` only affects nav/admin
    // UI visibility, not the underlying access-controlled API.
    hidden: ({ user }) => !isSuperAdmin(user) && !canManageSiteSettings(user),
  },
  access: {
    read: readAccess,
    // Only Super Admins provision or remove sites.
    create: ({ req: { user } }) => isSuperAdmin(user),
    update: updateAccess,
    delete: ({ req: { user } }) => isSuperAdmin(user),
  },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          // Unnamed tab: pure admin-UI grouping, no path prefix -- name/domain
          // stay top-level fields so existing site.domain relationship queries
          // (usePayloadPage, useSite) keep working unchanged.
          label: "General",
          fields: [
            {
              name: "name",
              type: "text",
              required: true,
            },
            {
              name: "domain",
              type: "text",
              required: true,
              unique: true,
              admin: {
                description: "e.g. news.clientdomain.com",
              },
            },
            {
              // Which theme package (Nuxt layer) renders this site's
              // layout. Resolved per-request by app.vue via useSite().
              // Options come from discoverThemes() above -- auto-discovered
              // from themes/ at container boot, not hand-maintained here. A
              // folder needs layouts/<value>.vue + theme.json to show up;
              // restart cms after adding one (config loads once at
              // boot, same as any other field).
              name: "theme",
              // Plain text, not `select`: a select is a Postgres enum, and a theme
              // folder added later would then need a database migration. The menu
              // is components/ThemeSelect; validation below is the real check.
              type: "text",
              required: true,
              // No `defaultValue`: that becomes a SQL default, so the core's table would differ with whichever themes
              // happen to be installed. A hook fills it in instead.
              hooks: { beforeValidate: [({ value }: { value?: string | null }) => value || DEFAULT_THEME] },
              validate: (value: string | null | undefined) =>
                THEMES.some((t) => t.value === value) || `Unknown theme "${value ?? ""}". Installed: ${THEMES.map((t) => t.value).join(", ")}.`,
              admin: {
                components: { Field: { path: "/components/ThemeSelect#ThemeSelect", clientProps: { options: THEMES } } },
                description: `Which theme's layout renders this site. Auto-discovered from themes/ at boot (${THEMES.length} found: ${THEMES.map((t) => t.value).join(", ")}); restart the CMS after adding a theme folder.`,
              },
            },
            {
              // A per-Site toggle, independent of a role's own module
              // capability -- a role CAN have forms:read, but whether a
              // given site HAS forms turned on at all is separate data.
              // Defaults to every registered module: an existing site
              // shouldn't lose access to something it already uses just
              // because this field didn't exist yet when it was created.
              name: "enabledModules",
              // Plain text, not a Postgres enum (see components/ModuleSelect): the list grows with the installed plugins.
              type: "text",
              hasMany: true,
              defaultValue: RBAC_MODULES.map((m) => m.value),
              admin: {
                components: { Field: { path: "/components/ModuleSelect#ModuleSelect", clientProps: { options: RBAC_MODULES.map((m) => ({ label: m.label, value: m.value })) } } },
                description: "Which content modules this site exposes at all, regardless of what any role is otherwise permitted to touch.",
              },
            },
          ],
        },
        {
          label: "Branding",
          fields: [
            {
              name: "logo",
              type: "upload",
              relationTo: "media",
              admin: { description: "Falls back to the site name as text when unset." },
            },
            {
              name: "tagline",
              localized: true,
              type: "text",
              admin: { description: "Short text shown next to the logo/site name in the header. Optional." },
            },
            {
              name: "showDonateButton",
              type: "checkbox",
              defaultValue: true,
              admin: { description: "Show the Donate button in the header. Off hides it entirely, not just visually." },
            },
            {
              name: "favicon",
              type: "upload",
              relationTo: "media",
              admin: { description: "Falls back to the platform default when unset." },
            },
            {
              name: "primaryColor",
              type: "text",
              defaultValue: "#f26522",
              admin: { description: "Hex color, e.g. #f26522" },
            },
            {
              name: "secondaryColor",
              type: "text",
              defaultValue: "#1a1a1a",
              admin: { description: "Hex color, e.g. #1a1a1a" },
            },
            {
              name: "headingFontFamily",
              type: "text",
              admin: { description: "CSS font-family name for headings, e.g. Anton. Falls back to the platform default when unset." },
            },
            {
              name: "bodyFontFamily",
              type: "text",
              admin: { description: "CSS font-family name for body text, e.g. Roboto. Falls back to the platform default when unset." },
            },
            {
              name: "googleFontsUrl",
              type: "text",
              admin: {
                description:
                  "The <link> href Google Fonts gives you after picking families/weights (fonts.google.com -> select fonts -> \"Get embed code\" -> the stylesheet URL). Loads whatever headingFontFamily/bodyFontFamily reference.",
              },
            },
            {
              name: "headerNavItems",
              type: "array",
              labels: { singular: "Nav Item", plural: "Nav Items" },
              fields: [
                translatable({ name: "label", type: "text", required: true }),
                { name: "href", type: "text", required: true },
              ],
            },
            {
              name: "footerColumns",
              type: "array",
              labels: { singular: "Footer Column", plural: "Footer Columns" },
              fields: [
                translatable({ name: "heading", type: "text", required: true }),
                {
                  name: "links",
                  type: "array",
                  fields: [
                    translatable({ name: "label", type: "text", required: true }),
                    { name: "href", type: "text", required: true },
                  ],
                },
              ],
            },
            {
              name: "socialLinks",
              type: "array",
              labels: { singular: "Social Link", plural: "Social Links" },
              fields: [
                {
                  name: "platform",
                  type: "select",
                  required: true,
                  options: ["instagram", "facebook", "youtube", "x", "tiktok", "linkedin", "other"],
                },
                { name: "url", type: "text", required: true },
              ],
            },
          ],
        },
        {
          label: "Privacy",
          fields: [
            {
              name: "privacyPolicyUrl",
              type: "text",
              validate: validateLinkUrl,
              admin: {
                description:
                  "Where this site's privacy policy lives (a full https:// address, or a path like /privacy). Forms link to it next to the consent notice.",
              },
            },
            {
              name: "privacyContactEmail",
              type: "email",
              admin: {
                description:
                  "Who people write to about their personal information: access, correction, withdrawing consent, complaints. Under PIPEDA an organization names someone accountable; put their address here and in your policy.",
              },
            },
          ],
        },
        {
          label: "Forms",
          fields: [
            {
              name: "formProtection",
              type: "group",
              label: "Bot protection keys",
              admin: {
                description:
                  "Keys for the Cloudflare Turnstile check, for forms on this site that use it (set per form, under the form's Protection). Get them from the Cloudflare dashboard: create a Turnstile widget for this site's domain. The built-in ALTCHA check needs no keys.",
              },
              fields: [
                {
                  name: "turnstileSiteKey",
                  type: "text",
                  label: "Turnstile site key",
                  admin: { description: "The public key. It is shown in the page's code, so it is not secret." },
                  validate: (value: string | null | undefined) => (!value || KEY.test(value) ? true : "That doesn't look like a Turnstile site key."),
                },
                {
                  name: "turnstileSecretKey",
                  type: "text",
                  label: "Turnstile secret key",
                  admin: {
                    description:
                      "Write-only: once saved it shows as bullets here and in the API. Leave the bullets alone to keep the current key, or type a new one to replace it. Clear it to remove it.",
                  },
                  // Only people who manage site settings can see the field at all, and even they get bullets.
                  access: { read: canSeeKeys },
                  // Payload validates after the encryption hook below has run, so the stored form is valid too.
                  validate: (value: string | null | undefined) => (!value || value === SECRET_MASK || value.startsWith("enc:v1:") || KEY.test(value) ? true : "That does not look like a Turnstile secret key."),
                  hooks: {
                    // The format check has to happen here, before the value is encrypted: Payload runs
                    // `validate` after the encryption hook below, when every value looks like "enc:v1:...".
                    beforeValidate: [
                      ({ value }) => {
                        if (value && value !== SECRET_MASK && !String(value).startsWith("enc:v1:") && !KEY.test(String(value))) {
                          throw new ValidationError({
                            collection: "sites",
                            errors: [{ path: "formProtection.turnstileSecretKey", message: "That does not look like a Turnstile secret key." }],
                          });
                        }
                        return value;
                      },
                    ],
                    // Bullets for everyone, except the form-intake endpoint, which asks for the real key
                    // (context.revealFormSecrets) and the save below, which needs the stored text (rawFormSecrets).
                    afterRead: [
                      ({ value, req }) => {
                        if (req.context?.revealFormSecrets) return decrypt(value as string);
                        if (req.context?.rawFormSecrets) return value;
                        return value ? SECRET_MASK : value;
                      },
                    ],
                    // The admin form sends back the bullets on any save that didn't touch this field: keep the stored key.
                    beforeChange: [
                      async ({ value, originalDoc, req }) => {
                        let next = value as string | null | undefined;
                        if (value === SECRET_MASK) {
                          const id = (originalDoc as { id?: string | number } | undefined)?.id;
                          const current = id
                            ? await req.payload.findByID({ collection: "sites", id, depth: 0, overrideAccess: true, context: { rawFormSecrets: true } })
                            : null;
                          next = (current as { formProtection?: { turnstileSecretKey?: string } } | null)?.formProtection?.turnstileSecretKey ?? "";
                        }
                        return encrypt(next);
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
        {
          label: "Advanced",
          fields: [
            {
              name: "customCss",
              type: "textarea",
              admin: {
                description:
                  "Raw CSS, injected site-wide as a <style> tag (apps/web/app.vue). CSS can't execute server-side code, so this is safe to expose more broadly than Custom JS below -- but it's still admin-only write, same as every other Sites field.",
              },
            },
            {
              name: "customJs",
              type: "textarea",
              admin: {
                description:
                  "Raw JavaScript, injected site-wide as an inline <script> tag and run in every visitor's browser with no consent step. For analytics, advertising pixels or any pasted script, use the Tracking tools screen (Administration, with the analytics plugin) instead, which wait for consent and let you pick where the code goes. Unlike Custom CSS, this genuinely executes code and is only as safe as this collection's own write access -- currently Super Admin plus whichever role(s) have manageSiteSettings (Site Admin by default). See apps/web/app.vue's \"Per-site custom CSS/JS\" comment for exactly how this is (and isn't) constrained by CSP.",
              },
            },
          ],
        },
      ],
    },
  ],
};
