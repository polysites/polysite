---
layout: home

hero:
  name: "One cockpit for every site you run."
  text: ""
  tagline: A multisite, static-first CMS for organizations that publish more than one website, with a drag-and-drop page builder, roles you edit from the admin, and a plugin and theme system that keeps the core generic.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: How it is built
      link: /architecture
    - theme: alt
      text: Example sites
      link: /guide/examples
    - theme: alt
      text: GitHub
      link: https://github.com/polysites/polysite

features:
  - title: Multisite by design
    details: Every site resolves by its own domain. Content, media and users are scoped per site, so an editor assigned to one site cannot see or change another.
  - title: Roles you edit in the admin
    details: A Super Admin creates and reshapes roles in the UI, with no code change and no deploy. Access fails closed, so anything not granted is denied.
  - title: Block-based page builder
    details: Compose pages from typed blocks and check them in Live Preview at mobile, tablet and desktop widths before publishing.
  - title: Per-site themes and branding
    details: Each site picks a theme at runtime. Logo, colors, fonts, navigation and footer are edited per site in the admin.
  - title: Plugins you drop in
    details: Add a folder, restart the CMS, and it is live. Remove one and nothing its users created is lost. Polysite runs without any.
  - title: Simple to operate
    details: One VM, Docker Compose, Caddy with automatic HTTPS, versioned images and a deploy script that backs up first and rolls back by itself. No Kubernetes required.
---
