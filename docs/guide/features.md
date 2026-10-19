# What Polysite does

## One back end, many sites

Polysite runs a network of public websites (news, informational pages, campaign
and petition sites) from one editorial back end. Editors use a familiar admin UI
and never touch code. Each site has its own domain, theme and branding, and the
public pages stay fast because the front end is static-first.

It is built for teams that today maintain a separate install per site and want
to stop paying that cost without giving up per-site isolation, branding or
access control.

## Features

### Multisite

Every site resolves by its own domain. Content, media and users are scoped per
site. An editor assigned to site A cannot see or change site B.

### Roles you edit in the admin

Roles are data, not code. A Super Admin creates and renames roles in the admin
and chooses which collections each role can touch and which operations it has:
create, read, update, delete, publish, unpublish, and clone across sites. There
is no deploy for a permission change.

Access fails closed. A missing role, collection or operation always resolves to
*deny*. One flag, `isSuperAdmin`, is deliberately not a role, so a misconfigured
role can never lock everyone out or escalate itself.

### Page builder and Live Preview

Pages are assembled from typed blocks: hero banners, text, FAQ accordions,
feature grids, form embeds, signup forms, leader spotlights, donation tiers and
commitment grids. Live Preview shows the real page at mobile, tablet and desktop
widths while you edit.

### Drafts, history and scheduling

Pages (and posts, with the news plugin) have **Save draft** and **Publish changes** buttons, a version history
you can compare and restore, scheduled publish and unpublish, and a *ready for review* marker. See
[Drafts and publishing](/guide/publishing).

### Work faster in the admin

Duplicate a page, or clone it to another site, straight from the list. Each page
row has a menu and a link to the live page.

### SEO

Meta title, description and social image fields that render into the page head,
plus managed 301 redirects and a unified list of every URL a site answers to.

### Privacy and consent

Forms can state their purpose and require a consent checkbox, and every submission keeps a
record of what the person was shown and agreed to. Submissions can delete themselves after a
set time. A register of privacy requests lets a team find, export and erase one person's
information, with a deadline tracker, all per site. Designed around PIPEDA. See
[Privacy and consent](/guide/privacy).

### Media

Uploads are resized and converted to WebP on the way in. Uploaded files are
served with a cache header so repeat visits don't re-download them.

### Forms

A dynamic form builder for petitions, sign-ups and contact forms. Each form shows its own
submissions, which are read-only, with a CSV export. Submissions are checked on the server against the form, protected by a
hidden trap field, a signed token and a rate limit, and only the site's own team can
read them. A form can also count as a petition: one signature per email address, and a public signature count
with an optional goal. See [Forms and sign-ups](/guide/forms).

### Events and tickets

Events with a page each, an RSVP form with a capacity and a waiting list, a calendar file, confirmation and reminder emails, and an
attendee list for staff. An event can sell tickets instead: prices are worked out on the server, the visitor pays on the payment
provider's own page (a card number never reaches the site), and places are confirmed only when the provider's records show the
payment. See [Events and tickets](/guide/events).

### Themes and branding

Each site picks a theme at runtime. Logo, colors, fonts, navigation, footer and
social links are edited per site. See [themes](/guide/themes).

### Plugins

Optional capabilities live outside the core and are added by dropping in a folder: news and articles, email,
analytics, notifications, sign-in security (single sign-on, two-factor, API keys), several languages per site,
visitor search, share buttons, signed webhooks, a WordPress importer, AI agents over MCP, an AI writing assistant, a setup checklist, and events with RSVP and tickets. Each keeps its data in its own tables, and
removing or switching one off never deletes what its users created. Polysite runs without any. See
[plugins](/guide/plugins).

### First-run setup

On an empty database the admin opens a setup page: create the administrator account (it becomes the Super
Admin) and name the first site, with an optional starter home page. See [Getting started](/guide/getting-started).

### Operations

One VM, Docker Compose, Caddy with automatic HTTPS, versioned images, and a
deploy script that backs up first and rolls back by itself. Nightly backups with a weekly test restore (see
[Backups and restore](/guide/backups)). Optional OpenTelemetry tracing. Lint and unit tests run in CI and in a
pre-commit hook.

### Security checks

On an https install the CMS refuses to start on placeholder secrets and the first administrator needs a setup token.
Sign-in and password-reset requests are limited per address, uploads and request bodies are capped, and Caddy adds
security headers. See [Securing an install](/guide/security).
