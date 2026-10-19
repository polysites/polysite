import { defineConfig } from "vitepress";

// Served from https://<org>.github.io/polysite/ on GitHub Pages, so every
// asset needs that prefix; DOCS_BASE=/ builds for local preview or a custom domain.
const base = process.env.DOCS_BASE ?? "/polysite/";

// Absolute address of the published site: link previews (Facebook, LinkedIn, Slack, X) need absolute URLs for the page and the image.
const siteUrl = "https://polysites.github.io/polysite/";
const siteDescription = "One cockpit for every site you run: a multisite, static-first CMS.";

export default defineConfig({
  title: "Polysite",
  description: siteDescription,
  base,
  lang: "en",
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ["link", { rel: "icon", href: `${base}favicon.svg`, type: "image/svg+xml" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:site_name", content: "Polysite" }],
    ["meta", { property: "og:locale", content: "en_US" }],
    ["meta", { property: "og:image", content: `${siteUrl}og-image.png` }],
    ["meta", { property: "og:image:width", content: "1200" }],
    ["meta", { property: "og:image:height", content: "630" }],
    ["meta", { property: "og:image:alt", content: "Polysite: one cockpit for every site you run, with three example sites" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:image", content: `${siteUrl}og-image.png` }],
  ],

  // Per-page share tags: title, description and the page's own address.
  transformHead({ pageData }) {
    const path = pageData.relativePath.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, "");
    const url = `${siteUrl}${path}`;
    const title =
      pageData.frontmatter?.layout === "home" ? "Polysite: the multisite CMS for organisations" : `${pageData.title} | Polysite`;
    const description = pageData.description || siteDescription;
    return [
      ["link", { rel: "canonical", href: url }],
      ["meta", { property: "og:url", content: url }],
      ["meta", { property: "og:title", content: title }],
      ["meta", { property: "og:description", content: description }],
      ["meta", { name: "twitter:title", content: title }],
      ["meta", { name: "twitter:description", content: description }],
    ];
  },

  // The architecture and brand guides keep their repo-root file names (the
  // README links to them) but get tidy URLs on the site.
  rewrites: {
    "ARCHITECTURE.md": "architecture.md",
    "BRAND.md": "brand.md",
  },

  themeConfig: {
    logo: { light: "/logo-horizontal.svg", dark: "/logo-horizontal-reversed.svg", alt: "Polysite CMS" },
    siteTitle: false,
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "API", link: "/guide/api" },
      { text: "Architecture", link: "/architecture" },
      { text: "Plugins", link: "/guide/plugins" },
      { text: "Themes", link: "/guide/themes" },
      { text: "Examples", link: "/guide/examples" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting started", link: "/guide/getting-started" },
          { text: "Requirements", link: "/guide/requirements" },
          { text: "What Polysite does", link: "/guide/features" },
          { text: "How it works", link: "/guide/how-it-works" },
          { text: "Plugins", link: "/guide/plugins" },
          { text: "Themes", link: "/guide/themes" },
          { text: "Example sites", link: "/guide/examples" },
          { text: "Drafts and publishing", link: "/guide/publishing" },
          { text: "Languages", link: "/guide/languages" },
          { text: "Search", link: "/guide/search" },
          { text: "Share buttons", link: "/guide/share-buttons" },
          { text: "Forms and sign-ups", link: "/guide/forms" },
          { text: "Events and tickets", link: "/guide/events" },
          { text: "Privacy and consent", link: "/guide/privacy" },
          { text: "Status and roadmap", link: "/guide/status" },
        ],
      },
      {
        text: "Running Polysite",
        items: [
          { text: "Configuration", link: "/guide/configuration" },
          { text: "Securing an install", link: "/guide/security" },
          { text: "Backups and restore", link: "/guide/backups" },
          { text: "Releases and versions", link: "/guide/releasing" },
          { text: "Updating Payload", link: "/guide/updating-dependencies" },
        ],
      },
      {
        text: "Deploy",
        items: [
          { text: "Options at a glance", link: "/guide/deploy/" },
          { text: "Docker Compose + Caddy", link: "/guide/deploying" },
          { text: "Your own proxy (Apache, nginx, Traefik)", link: "/guide/deploy/proxy" },
          { text: "A single VM (EC2, GCE, cloud-init)", link: "/guide/deploy/vm" },
          { text: "Kubernetes (Helm)", link: "/guide/deploy/kubernetes" },
          { text: "Bare metal, no containers", link: "/guide/deploy/baremetal" },
          { text: "Managed platforms", link: "/guide/deploy/managed" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "API reference", link: "/guide/api" },
          { text: "Architecture", link: "/architecture" },
          { text: "Brand guide", link: "/brand" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/polysites/polysite", ariaLabel: "Polysite on GitHub" }],
    outline: { level: [2, 3] },
    search: { provider: "local" },
    footer: {
      message: "Released under the Polysite Source-Available License. Not open source.",
      copyright: "© 2026 Quick Support Today Inc.",
    },
  },
});
