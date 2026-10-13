// Local development only: creates fictional demo sites, pages and accounts.
// Never run it against a real install (it adds a Super Admin).
// Run inside the CMS container: npx payload run scripts/seedDevData.ts
//
// The demo accounts share one password: SEED_PASSWORD from the environment, or a
// random one generated for this run and printed at the end.
//
// Safe to run again: every record is looked up first and only created when missing, so a run that failed half way is
// completed by the next one, and a run on a finished seed says so and changes nothing. It refuses a database that
// already has other users (a real install) unless SEED_FORCE=1.
import { randomBytes } from "node:crypto";

import { getPayload } from "payload";

import { THEMES } from "../src/collections/Sites";
import config from "../src/payload.config";
import { seedPluginDevData } from "./devPlugins";

// The demo sites use the first theme the Sites dropdown would offer: "starter" when the themes repository is cloned,
// otherwise whichever theme is installed, otherwise the core's own "default". SEED_THEME overrides it.
const seedTheme = process.env.SEED_THEME ?? THEMES.find((t) => t.value === "starter")?.value ?? THEMES[0]?.value ?? "default";
const DEMO_ADMIN_EMAIL = "admin@dev.local";

const devPassword = process.env.SEED_PASSWORD ?? randomBytes(12).toString("base64url");

// payload's `run` CLI awaits this module's dynamic import() before exiting
// the process -- a fire-and-forget async call at the bottom (no top-level
// await) lets that import() resolve immediately, so the process exits
// before any of this actually runs. Top-level await keeps it alive until
// the seed genuinely finishes.
{
  const payload = await getPayload({ config });

  const roles = await payload.find({ collection: "roles", limit: 0, overrideAccess: true });
  // Throws rather than returning undefined -- seedRoles.ts's idempotent
  // onInit seeding must have already run (every boot) before this script
  // does; a missing role here means something's genuinely wrong, not a
  // case to silently create a role-less user for.
  const roleId = (name: string): number => {
    const role = roles.docs.find((r) => r.name === name);
    if (!role) throw new Error(`Role "${name}" not found -- has seedRoles.ts run yet?`);
    return role.id;
  };

  const demoAdmin = await payload.find({ collection: "users", where: { email: { equals: DEMO_ADMIN_EMAIL } }, limit: 1, overrideAccess: true });
  const anyUsers = await payload.count({ collection: "users", overrideAccess: true });
  if (!demoAdmin.docs[0] && anyUsers.totalDocs > 0 && process.env.SEED_FORCE !== "1") {
    console.error(
      "This database already has users and none is the demo administrator, so it looks like a real install. " +
        "The demo seed adds a Super Admin with a known password, so it stops here. " +
        "Use an empty database (docker compose down -v), or set SEED_FORCE=1 if you are sure.",
    );
    process.exit(1);
  }

  // Looks a record up and creates it only when missing, and notes which it created so a re-run can say what it did.
  type Seeded = { id: number; email?: string };
  const created: string[] = [];
  const ensure = async (
    collection: "users" | "sites" | "forms" | "pages",
    label: string,
    where: Record<string, unknown>,
    data: Record<string, unknown>,
  ): Promise<Seeded> => {
    const found = await payload.find({ collection, where: where as never, limit: 1, depth: 0, overrideAccess: true });
    if (found.docs[0]) return found.docs[0] as unknown as Seeded;
    const doc = (await payload.create({ collection, data: data as never, overrideAccess: true })) as unknown as Seeded;
    created.push(label);
    return doc;
  };
  const byEmail = (email: string) => ({ email: { equals: email } });
  const homeOf = (siteId: number) => ({ and: [{ slug: { equals: "/" } }, { site: { equals: siteId } }] });

  const superAdmin = await ensure("users", "demo administrator", byEmail(DEMO_ADMIN_EMAIL), {
    email: DEMO_ADMIN_EMAIL,
    password: devPassword,
    role: roleId("Super Admin"),
    isSuperAdmin: true,
  });

  // Fictional navigation for the demo sites. The core renders only what a site has set, so without this a demo site
  // would show an empty header and footer.
  const demoNavigation = {
    headerNavItems: [
      { label: "Leader", href: "/leader" },
      { label: "Our Team", href: "/team" },
      { label: "About Us", href: "/about-us" },
      { label: "Our Platform", href: "/our-platform" },
      { label: "Take Action", href: "/take-action" },
      { label: "Volunteer", href: "/volunteer" },
      { label: "FAQ", href: "/faq" },
      { label: "Become a member", href: "/join" },
    ],
    footerColumns: [
      {
        heading: "Learn",
        links: [
          { label: "Leader", href: "/leader" },
          { label: "Our Team", href: "/team" },
          { label: "About Us", href: "/about-us" },
          { label: "Our Platform", href: "/our-platform" },
        ],
      },
      {
        heading: "Get Involved",
        links: [
          { label: "Take Action", href: "/take-action" },
          { label: "Volunteer", href: "/volunteer" },
          { label: "FAQ", href: "/faq" },
          { label: "Become a member", href: "/join" },
        ],
      },
    ],
    socialLinks: [
      { platform: "instagram" as const, url: "#" },
      { platform: "facebook" as const, url: "#" },
      { platform: "youtube" as const, url: "#" },
    ],
  };

  const devTestSite = await ensure("sites", "first demo site", { domain: { equals: "voidslate.localhost" } }, {
    name: "Dev Test Site",
    domain: "voidslate.localhost",
    ...demoNavigation,
    privacyPolicyUrl: "/privacy",
    privacyContactEmail: "privacy@example.org",
    theme: seedTheme,
    primaryColor: "#FA6400",
    secondaryColor: "#00484E",
    headingFontFamily: "Anton",
    bodyFontFamily: "Roboto",
  });

  // A demo sign-up form for the first site: email and postal code, the shape the
  // sign-up block on the home page submits to.
  const joinForm = await ensure("forms", "sign-up form", { and: [{ title: { equals: "Join the movement" } }, { site: { equals: devTestSite.id } }] }, {
      title: "Join the movement",
      site: devTestSite.id,
      submitButtonLabel: "Join Now",
      privacy: {
        purpose: "We'll use your email and postal code to send campaign updates. We never share them.",
        consentRequired: true,
        consentLabel: "I agree to receive updates.",
        retentionDays: 365,
      },
      confirmationType: "message",
      confirmationMessage: {
        root: {
          type: "root",
          format: "",
          indent: 0,
          version: 1,
          direction: "ltr",
          children: [
            {
              type: "paragraph",
              format: "",
              indent: 0,
              version: 1,
              direction: "ltr",
              children: [{ type: "text", text: "Thanks for joining. We'll be in touch.", version: 1, format: 0, detail: 0, mode: "normal", style: "" }],
            },
          ],
        },
      },
      fields: [
        { blockType: "email", name: "email", label: "Email address", required: true },
        { blockType: "text", name: "postalCode", label: "Postal code", required: true },
      ],
    });

  const secondSite = await ensure("sites", "second demo site", { domain: { equals: "second.localhost" } }, {
    name: "Second Demo Site",
    domain: "second.localhost",
    ...demoNavigation,
    theme: seedTheme,
    tagline: "A second demo site",
    showDonateButton: false,
    customCss: "/* demo custom CSS */\n.site-shell { --demo-marker: 1; }",
    customJs: "console.log('[demo] second site custom JS loaded');",
  });

  const siteAdmin = await ensure("users", "site administrator", byEmail("campaignmanager@dev.localhost"), {
    email: "campaignmanager@dev.localhost",
    password: devPassword,
    role: roleId("Site Admin"),
    assignedSites: [{ site: devTestSite.id }],
  });

  const siteUser = await ensure("users", "site user", byEmail("contenteditor@dev.localhost"), {
    email: "contenteditor@dev.localhost",
    password: devPassword,
    role: roleId("Site User"),
    assignedSites: [{ site: devTestSite.id }],
  });

  await ensure("pages", "first site home page", homeOf(devTestSite.id), {
      title: "Home",
      slug: "/",
      _status: "published",
      site: devTestSite.id,
      content: [
        {
          blockType: "leaderSpotlight",
          name: "Alex Morgan",
          title: "Party Leader",
          quote: "Every community deserves a fair shot -- that's what this campaign is about.",
          ctaLabel: "Meet the Leader",
        },
        {
          blockType: "commitmentsGrid",
          heading: "Our Commitments",
          items: [
            { heading: "Affordable Housing", body: "Investing in new supply and stronger tenant protections so housing costs stop outpacing local wages." },
            { heading: "Universal Childcare", body: "Expanding affordable, licensed childcare spaces so no family has to choose between work and their kids." },
            { heading: "Climate Action", body: "Cutting emissions through public transit investment, clean energy jobs, and modernized building codes." },
          ],
        },
        { blockType: "donationTiers", heading: "Fund the Movement", amounts: [{ amount: 5 }, { amount: 25 }, { amount: 50 }, { amount: 100 }, { amount: 250 }] },
        { blockType: "signupForm", heading: "Join the Movement", subheading: "Be part of the campaign from day one.", ctaLabel: "Join Now", form: joinForm.id },
      ],
    });

  await ensure("pages", "second site home page", homeOf(secondSite.id), {
      title: "Home",
      slug: "/",
      _status: "published",
      site: secondSite.id,
      content: [
        { blockType: "hero", heading: "A Fresh Start for Everyone", subheading: "Real solutions for working families, built from the ground up." },
        {
          blockType: "featureGrid",
          heading: "Our Priorities",
          features: [
            { title: "Affordable Homes", description: "Building more homes people can actually afford, faster." },
            { title: "Better Healthcare", description: "Shorter wait times and more family doctors in every community." },
            { title: "Good Local Jobs", description: "Investing in local industries that pay fair, living wages." },
          ],
        },
        { blockType: "donationTiers", heading: "Support the Campaign", amounts: [{ amount: 10 }, { amount: 25 }, { amount: 50 }] },
      ],
    });

  if (created.length === 0) {
    console.log(
      `The demo data is already loaded (${superAdmin.email}, two sites and their home pages); nothing to do. ` +
        "The accounts keep the password printed when they were created. To start over: docker compose down -v, then up and seed again.",
    );
  } else {
    // Demo content from any installed plugin (news posts, say) for the first site.
    await seedPluginDevData(payload, devTestSite);

    const newAccounts = created.some((c) => c.includes("administrator") || c === "site user");
    console.log("Seed complete. Created:", created.join(", "), "(an account that already existed keeps its old password)");
    console.log({
      theme: seedTheme,
      ...(newAccounts ? { passwordOfTheAccountsCreatedNow: devPassword } : {}),
      superAdmin: superAdmin.email,
      siteAdmin: siteAdmin.email,
      siteUser: siteUser.email,
      devTestSite: devTestSite.id,
      secondSite: secondSite.id,
    });
  }
}
