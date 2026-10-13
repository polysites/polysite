// Shared by every theme's layout (layouts/acme.vue, layouts/bakery.vue, ...)
// so the branding-data wiring -- computing CSS vars, falling back to demo
// content when a field is unset -- lives in exactly one place instead of
// being copy-pasted (and drifting) per theme. Themes stay responsible for
// their own markup/structure only.
//
// Deliberately SYNCHRONOUS, taking the already-resolved `site` ref as a
// parameter instead of calling useSite() itself: a real bug, caught for
// real (500 "composable... called outside of a plugin/setup function") when
// this used to `await useSite()` internally before calling useHead() -- Vue
// only restores a component's Nuxt-instance context across an `await` for
// the setup function's OWN top-level awaits, not one buried inside a
// function that setup merely calls. Each layout now does
// `const site = await useSite()` itself (a real top-level await, proven
// safe -- usePayloadPage is called the same way in [...slug].vue), then
// passes the resolved ref into this synchronous helper.
//
// A new Site with nothing set renders a plain header and footer (its name, nothing invented). Colours and fonts
// have neutral defaults; the menu, footer and social links have none.
import type { PayloadSite } from "../types/payload";

export function useSiteBranding(site: Ref<PayloadSite | null | undefined>) {
  const siteName = computed(() => site.value?.name || "Polysite Party");
  const tagline = computed(() => site.value?.tagline || "");
  const showDonateButton = computed(() => site.value?.showDonateButton !== false);
  const primaryColor = computed(() => site.value?.primaryColor || "#f26522");
  const secondaryColor = computed(() => site.value?.secondaryColor || "#1a1a1a");
  const bodyFontStack = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
  const brandVars = computed(() => ({
    "--brand-primary": primaryColor.value,
    "--brand-secondary": secondaryColor.value,
    "--font-body": site.value?.bodyFontFamily ? `"${site.value.bodyFontFamily}", ${bodyFontStack}` : bodyFontStack,
    "--font-heading": site.value?.headingFontFamily
      ? `"${site.value.headingFontFamily}", ${bodyFontStack}`
      : undefined,
    "font-family": "var(--font-body)",
  }));

  // Google Fonts stylesheet is per-site data (Sites.googleFontsUrl), not a
  // hardcoded <link> -- loads whatever headingFontFamily/bodyFontFamily
  // actually reference, or nothing at all when a Site has no fonts configured.
  useHead({
    link: computed(() =>
      site.value?.googleFontsUrl ? [{ rel: "stylesheet", href: site.value.googleFontsUrl }] : [],
    ),
  });

  // Navigation, footer columns and social links are exactly what the site has set. A new site has none, so its header
  // and footer show only its name: nothing invented that would link to pages the site doesn't have. (The dev demo
  // sites get their menu from scripts/seedDevData.ts.)
  const navItems = computed(() => site.value?.headerNavItems ?? []);
  const footerColumns = computed(() => site.value?.footerColumns ?? []);
  const socialLinks = computed(() => site.value?.socialLinks ?? []);
  const socialIcons: Record<string, string> = {
    instagram: "lucide:instagram",
    facebook: "lucide:facebook",
    youtube: "lucide:youtube",
    x: "lucide:twitter",
    tiktok: "lucide:music-2",
    linkedin: "lucide:linkedin",
    other: "lucide:link",
  };

  return {
    siteName,
    tagline,
    showDonateButton,
    brandVars,
    navItems,
    footerColumns,
    socialLinks,
    socialIcons,
  };
}
