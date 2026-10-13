// Minimal Payload CMS response shapes this app actually reads -- deliberately
// NOT the full generated apps/cms/src/payload-types.ts. That file lives in a
// different Docker build context (apps/cms is built and deployed
// independently of apps/web); importing it directly would couple two
// services that only ever talk to each other over the REST API. Each type
// below only lists the fields a composable/component/page here touches.

export interface PayloadImage {
  url?: string;
  alt?: string;
}

export interface PayloadBlock {
  id?: string;
  blockType: string;
  [key: string]: unknown;
}

export interface PayloadPage {
  id?: string;
  title?: string;
  slug?: string;
  content?: PayloadBlock[];
  meta?: {
    title?: string;
    description?: string;
    image?: PayloadImage;
  };
}

export interface PayloadNavItem {
  label: string;
  href: string;
}

export interface PayloadFooterColumn {
  heading: string;
  links: PayloadNavItem[];
}

export interface PayloadSocialLink {
  platform: string;
  url: string;
}

export interface PayloadSite {
  id?: string;
  domain?: string;
  name?: string;
  tagline?: string;
  showDonateButton?: boolean;
  primaryColor?: string;
  secondaryColor?: string;
  bodyFontFamily?: string;
  headingFontFamily?: string;
  googleFontsUrl?: string;
  headerNavItems?: PayloadNavItem[];
  footerColumns?: PayloadFooterColumn[];
  socialLinks?: PayloadSocialLink[];
  enabledModules?: string[];
  privacyPolicyUrl?: string;
  // The public part of the per-site settings that plugins keep in their own collections, by key (`extensions.search`, ...);
  // a plugin's web layer reads its own key with its own type. The core reads one of them: `languages`, the site's language
  // choice (utils/language.ts); a site without it offers English only.
  extensions?: {
    languages?: { languages?: string[] | null; defaultLanguage?: string | null } | null;
    [key: string]: unknown;
  };
  // Plugins may still add fields of their own to a site; the plugin's web layer reads them with its own type.
  [pluginSetting: string]: unknown;
}

export interface PayloadRedirectTarget {
  relationTo?: "pages" | "media" | "forms";
  value?: {
    slug?: string;
    url?: string;
    landingPage?: { slug?: string } | string | null;
  };
}

export interface PayloadRedirect {
  redirectType?: "internal" | "external";
  toUrl?: string;
  statusCode?: number;
  toTarget?: PayloadRedirectTarget;
}
