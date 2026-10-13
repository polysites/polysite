import { defineConfig } from "vitepress";

// Served from https://<org>.github.io/polysite/ on GitHub Pages, so every
// asset needs that prefix; DOCS_BASE=/ builds for local preview or a custom domain.
const base = process.env.DOCS_BASE ?? "/polysite/";

export default defineConfig({
  title: "Polysite",
  description: "One cockpit for every site you run: a multisite, static-first CMS.",
  base,
  lang: "en",
  cleanUrls: true,
  lastUpdated: true,
  head: [["link", { rel: "icon", href: `${base}favicon.svg`, type: "image/svg+xml" }]],

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
      { text: "Architecture", link: "/architecture" },
      { text: "Plugins", link: "/guide/plugins" },
      { text: "Themes", link: "/guide/themes" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting started", link: "/guide/getting-started" },
          { text: "Requirements", link: "/guide/requirements" },
          { text: "What Polysite does", link: "/guide/features" },
          { text: "Plugins", link: "/guide/plugins" },
          { text: "Themes", link: "/guide/themes" },
          { text: "Drafts and publishing", link: "/guide/publishing" },
          { text: "Languages", link: "/guide/languages" },
          { text: "Search", link: "/guide/search" },
          { text: "Share buttons", link: "/guide/share-buttons" },
          { text: "Forms and sign-ups", link: "/guide/forms" },
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
          { text: "Architecture", link: "/architecture" },
          { text: "Brand guide", link: "/brand" },
        ],
      },
    ],
    outline: { level: [2, 3] },
    search: { provider: "local" },
    footer: {
      message: "Released under the Polysite Source-Available License. Not open source.",
      copyright: "© 2026 Quick Support Today Inc.",
    },
  },
});
