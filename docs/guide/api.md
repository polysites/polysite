# API reference

Everything the admin and the public site do goes through an API you can use too: to build a custom front end, import
content, wire Polysite to another system, or let an AI agent edit a site. There are three ways in:

| | Address | Use it for |
| --- | --- | --- |
| **REST** | `https://<your CMS address>/api/...` | Reading and writing content, signing in, uploading files |
| **GraphQL** | `https://<your CMS address>/api/graphql` | The same data, when you want to pick the fields in one request |
| **MCP** | `https://<your CMS address>/api/mcp` | AI agents; see [AI agents (MCP)](#ai-agents-mcp) |

Polysite uses [Payload CMS](https://payloadcms.com) underneath, so the generic query language, pagination and error
shapes are Payload's. This page covers what is specific to Polysite: its collections, who may do what, drafts, the form
endpoints, search, keys and agents. Payload's own documentation covers the rest of the query language.

Examples use the local development addresses (`polysite.localhost` for the CMS, `voidslate.localhost` for a site) and `curl`.
Swap in your own. The CMS address is `CMS_DOMAIN` in your `.env`; each site's address is its **domain** in the admin. The
public site's own domain also serves `/api` (the proxy sends it to the CMS), which matters for the form endpoints below.

::: tip Try it
Every example here was run against a development stack. Responses are shortened, and ids will differ on your install.
:::

## Basics

- Requests and responses are JSON (`Content-Type: application/json`), except file uploads and the CSV export.
- Lists look like `{"docs": [...], "totalDocs": 12, "limit": 10, "page": 1, "totalPages": 2, "hasNextPage": true, ...}`. The
  default page is 10 documents; `limit` and `page` change it, and `limit=0` returns everything.
- Errors from the standard routes look like `{"errors": [{"message": "..."}]}`. The Polysite endpoints (forms, search, setup,
  privacy) answer `{"message": "..."}`, with `errors` added for field problems.
- `GET /api/health` answers `{"status":"ok","version":"..."}` and needs no sign-in. Point an uptime monitor at it.
- Every response carries the security headers described in [Securing an install](/guide/security).

### Reading with query parameters

Every collection's list route takes the same parameters. In `curl`, add `-g` so the square brackets are not treated as a pattern.

| Parameter | Does | Example |
| --- | --- | --- |
| `where[field][operator]=value` | Filters. Operators include `equals`, `not_equals`, `in`, `contains`, `like`, `greater_than`, `less_than`, `exists`. Nest with `where[and][0]...` and `where[or][0]...` | `where[site.domain][equals]=voidslate.localhost` |
| `sort` | Field name; a leading `-` sorts the other way | `sort=-createdAt` |
| `limit`, `page` | Paging | `limit=20&page=2` |
| `depth` | How many levels of related documents to fill in (default 2). Use `depth=0` for plain ids | `depth=0` |
| `select[field]=true` | Returns only the listed fields | `select[title]=true&select[slug]=true` |
| `draft=true` | Signed in only: the latest draft of each document instead of the live version | `draft=true` |
| `locale`, `fallback-locale` | The language to return, and the one to use where it has no text (see [Languages](/guide/languages)) | `locale=fr&fallback-locale=en` |

```bash
curl -g "https://polysite.localhost/api/pages?where[site.domain][equals]=voidslate.localhost&depth=0&limit=1&select[title]=true&select[slug]=true"
```

```json
{ "docs": [{ "id": 1, "site": 1, "title": "Home", "slug": "/" }], "totalDocs": 1, "limit": 1, "page": 1, "totalPages": 1, "hasNextPage": false }
```

A slug is unique **within a site**, not across the install. To find a page, always filter by site (its id, or its domain as above).

## Sign in

Three kinds of caller exist, and all of them act as a person, so a person's role and assigned sites limit what the request can do:

- **Nobody signed in.** Can read what is published, and use the public form, count and search endpoints.
- **A signed-in person** (a session token). What their role allows: see [Roles and sites](#roles-and-sites).
- **A key.** An API key (the auth plugin) or an MCP key acts as the person who made it.

### Sign in with a password

```bash
curl -X POST https://polysite.localhost/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.org", "password": "your password"}'
```

```json
{ "message": "Authentication Passed", "token": "eyJhbGciOi...", "exp": 1792310174, "user": { "id": 1, "email": "you@example.org", "role": { "name": "Super Admin" } } }
```

The same response sets an `HttpOnly` cookie (`payload-token`) for browsers. A script sends the token instead:

```bash
curl -H "Authorization: JWT eyJhbGciOi..." https://polysite.localhost/api/users/me
```

| Route | Does |
| --- | --- |
| `POST /api/users/login` | Returns a token. A wrong email or password answers 401 `The email or password provided is incorrect.`; five wrong passwords lock the account for ten minutes, and sign-in attempts are also limited per address |
| `GET /api/users/me` | Who the token belongs to, with their role |
| `POST /api/users/refresh-token` | A fresh token (`refreshedToken`) before the old one expires; tokens last two hours |
| `POST /api/users/logout` | Ends the session. **The token stops working immediately**, wherever it was copied |
| `POST /api/users/forgot-password`, `POST /api/users/reset-password` | The password reset flow |

With the [auth plugin](https://github.com/polysites/polysite-plugins/tree/main/auth) installed, a person with two-factor sign-in
switched on is asked for a code after the password, and single sign-on accounts have no password to send. Scripts should use a key instead.

### API keys (auth plugin)

A key lets a script sign in without a password or a code. Switch the feature on with `AUTH_API_KEYS=true` in `.env` and restart
the CMS. Then each person makes their own keys on their account page (up to ten, each with a label and an optional expiry in days), or
by calling the plugin's endpoints with a real sign-in:

```bash
curl -X POST https://polysite.localhost/api/auth-keys/issue \
  -H "Authorization: JWT eyJhbGciOi..." -H "Content-Type: application/json" \
  -d '{"label": "Nightly import", "expiresInDays": 90}'
```

The reply holds the key, shown **once** (`"key": "psk_ab12cd34_..."`). Use it as a bearer token:

```bash
curl -H "Authorization: Bearer psk_ab12cd34_..." https://polysite.localhost/api/users/me
```

| Route | Does |
| --- | --- |
| `GET /api/auth-keys/list` | Your keys (a prefix, label, last use, expiry; never the key itself) |
| `POST /api/auth-keys/issue` | `{ "label", "expiresInDays" }` makes a key |
| `POST /api/auth-keys/revoke` | `{ "id" }` deletes one of your keys. A Super Admin can delete anyone's |

A key can do exactly what its owner can and no more, skips the second factor, and works until it expires or is deleted. It cannot
make or delete keys: those three routes need a password sign-in. With the feature off they answer 404 `API keys are switched off`.
More in the plugin's README.

## Roles and sites

Polysite has several sites in one install, and each person works on the sites they are assigned. Access is decided per collection:

| Collection | Anyone, signed out | Signed-in editors |
| --- | --- | --- |
| `pages` | Published pages only | Their sites' pages, drafts included; create, edit, delete and publish as the role allows |
| `media` | Read | Their sites' files; upload and delete as the role allows |
| `sites` | Read the public settings (see below) | Edit settings if the role has **manage site settings** |
| `redirects` | Read | As the role allows |
| `forms` | Nothing | Their sites' forms, as the role allows |
| `form-submissions` | Nothing | Read as the role allows; **never created or edited by hand** |
| `users`, `roles` | Nothing | Super Admins list and manage; anyone can read their own user |
| `posts` and other [plugin](/guide/plugins) collections | Published only | Like pages |

A request is refused with `403 You are not allowed to perform this action.` when the role or the site does not allow it. The
rules are the same as in the admin: the API is the admin's own back end, so the role matrix in **Administration → Roles**
applies to every request. `GET /api/access` (signed in) lists what the current person may do.

## Pages

`/api/pages` holds the pages of every site. Fields you will use:

| Field | Meaning |
| --- | --- |
| `title`, `slug` | The page's name and its address on the site. The home page's slug is `/` |
| `site` | The site's id (required) |
| `content` | The page itself: a list of **blocks**, each with a `blockType` such as `hero`, `featureGrid`, `cta`, `faqAccordion`, `formEmbed`, `signupForm`, `gallery`, `testimonials`, `team`, `stats` or `timeline`. Each block type has its own fields; the admin's page editor shows them, and the [AI agents tool](#ai-agents-mcp) `polysite_describe_blocks` lists them with every field |
| `meta` | SEO title, description and image |
| `_status` | `draft` or `published` |
| `reviewState`, `reviewNote` | The review marker and its note (see [Drafts and publishing](/guide/publishing)) |

```bash
# create (a new page is always a draft)
curl -X POST "https://polysite.localhost/api/pages" \
  -H "Authorization: JWT $TOKEN" -H "Content-Type: application/json" \
  -d '{"title": "Get involved", "slug": "get-involved", "site": 1,
       "content": [{"blockType": "hero", "heading": "Get involved", "subheading": "Join the campaign"}]}'
```

The reply is `{"doc": {...}, "message": "Page successfully created."}`, with `"_status": "draft"`. `PATCH /api/pages/:id` changes
a page, `DELETE /api/pages/:id` removes it, and `GET /api/pages/:id` reads one. To change fields without touching
what visitors see, see the next section.

### Drafts and publishing

A page (and every post) keeps a **live version** and, separately, a **draft** (see [Drafts and publishing](/guide/publishing)
for how editors see it). Over the API:

| Goal | Request |
| --- | --- |
| Create a page that is not live | `POST /api/pages` (the default) |
| Publish a page | `PATCH /api/pages/:id` with `{"_status": "published"}` |
| Edit a live page *without* changing the live page | `PATCH /api/pages/:id?draft=true` with the change |
| Take a live page offline | `PATCH /api/pages/:id` with `{"_status": "draft"}` |
| Read the live version | `GET /api/pages/:id` |
| Read the latest draft | `GET /api/pages/:id?draft=true` (signed in) |
| History | `GET /api/pages/versions?where[parent][equals]=:id` |

The two details that catch people: **a PATCH without `?draft=true` on a live page changes the live page**, because that is a
publish; and publishing and unpublishing are separate permissions, so an editor who can save may still be refused with a
`403` when the request would change what visitors see. Visitors, and calls made signed out, only ever see the live version.

```bash
# the live title still reads "Get involved" after a draft edit
curl -X PATCH "https://polysite.localhost/api/pages/4?draft=true" \
  -H "Authorization: JWT $TOKEN" -H "Content-Type: application/json" \
  -d '{"title": "Get involved (new wording)"}'
curl -g "https://polysite.localhost/api/pages/4?select[title]=true"                       # signed out: the live title
curl -g -H "Authorization: JWT $TOKEN" "https://polysite.localhost/api/pages/4?draft=true&select[title]=true"   # the draft
```

### Copy a page to another site

```bash
curl -X POST https://polysite.localhost/api/pages/4/clone \
  -H "Authorization: JWT $TOKEN" -H "Content-Type: application/json" \
  -d '{"targetSiteId": 2}'
```

Answers `{"doc": {...}}`. The copy is always a **draft** on the target site (with `-copy` added to the slug if that site already has one).
It needs the **copy across sites** permission and access to both sites; otherwise 403 (or 400 `Missing targetSiteId`).

## Media

`/api/media` holds uploaded files, one library per site. Upload with `multipart/form-data`: the file in `file`, the other fields as JSON in `_payload`.

```bash
curl -X POST "https://polysite.localhost/api/media" \
  -H "Authorization: JWT $TOKEN" \
  -F '_payload={"alt": "Volunteers at the spring rally", "site": 1}' \
  -F "file=@rally.png;type=image/png"
```

`alt` text is required. A PNG or JPEG upload is converted to WebP, and the reply lists the file's `url` (under `/api/media/file/`) and
the generated `sizes` (`thumbnail`, `card`, ...). Use the media `id` wherever a block takes an image. The size limit is 25 MB
(`POLYSITE_MAX_UPLOAD_MB`); a larger file is refused.

## Sites

`/api/sites` holds each site's settings: `name`, `domain`, `theme`, `logo`, `tagline`, colours and fonts, `headerNavItems`, `footerColumns`,
`enabledModules`, `privacyPolicyUrl` and more. Signed out you get the public settings the front end needs; secrets (for example the
Turnstile secret key) are never returned. A plugin's per-site settings appear under `extensions` (for example `site.extensions.search.enabled`).

```bash
curl -g "https://polysite.localhost/api/sites?depth=0&select[name]=true&select[domain]=true"
```

Changing a site (`PATCH /api/sites/:id`) needs the **manage site settings** permission for that site.

## Forms and submissions

Forms are made in the admin or through `/api/forms`. Their answers are stored in `form-submissions`, which holds personal
information: nobody can create one through the standard routes, and signed out nothing can be read.
A form that has submissions cannot be deleted; retention or a [privacy request](/guide/privacy) removes the submissions first.

### The public form endpoints

Visitors use three routes on the **site's own domain** (`https://voidslate.localhost/api/...`). A form belongs to one site, and a
request for it on any other host answers `404 Form not found.`

#### `GET /api/form-intake/:id`: the form

The form's fields, privacy wording and a signed token. The email settings are never included.

```bash
curl https://voidslate.localhost/api/form-intake/1
```

```json
{
  "id": 1, "title": "Join the movement", "submitButtonLabel": "Join Now",
  "fields": [
    { "blockType": "email", "name": "email", "label": "Email address", "required": true, "width": null },
    { "blockType": "text", "name": "postalCode", "label": "Postal code", "required": true, "width": null, "defaultValue": null }
  ],
  "privacy": { "purpose": "We'll use your email and postal code to send campaign updates.", "consentRequired": true, "consentLabel": "I agree to receive updates.", "retentionDays": 365, "policyUrl": "/privacy" },
  "honeypot": "website_url",
  "signatures": null,
  "token": "1792303023026.qmG7L8Z9...",
  "captcha": null
}
```

`signatures` is `{"goal": 100}` when the form shows a public count (below). `captcha` holds the challenge when the form asks for a bot
check. A form set to Turnstile whose site has no keys answers `503 This form isn't available right now.`

#### `POST /api/form-intake/:id`: a submission

```bash
curl -X POST https://voidslate.localhost/api/form-intake/1 \
  -H "Content-Type: application/json" \
  -d '{"token": "<token from the GET>", "data": {"email": "sam@example.org", "postalCode": "A1A 1A1"}, "consent": true}'
```

```json
{ "ok": true, "confirmationType": "message", "message": "<p>Thanks, you are on the list.</p>" }
```

With the form set to redirect, the reply is `{"ok": true, "confirmationType": "redirect", "redirect": "https://..."}`. Send:

- `token`, from the GET. It must be between 1.5 seconds and 6 hours old, which stops a script that never loaded the form.
- `data`, an object keyed by the fields' `name`. Unknown names are dropped; required, email, number, date, select and length rules are checked on the server.
- `consent: true` when the form asks for consent.
- `captcha`, the solved challenge, when the form asks for one.
- Leave the field named by `honeypot` out. A request that fills it is treated as a bot and gets a fake success.

| Status | Body | Meaning |
| --- | --- | --- |
| 200 | `{"ok": true, ...}` | Saved (or, on a one-signature-per-address form, an address already counted: the reply is the same on purpose) |
| 400 | `This form has expired. Reload the page and try again.` | Bad, forged or too-old token; or a body that is not JSON |
| 404 | `Form not found.` | No such form, or not this host's |
| 413 | `That submission is too large.` | Over 32 KB |
| 422 | `{"message": "Please fix the highlighted fields.", "errors": {"email": "Enter a valid email address."}}` | Field problems, keyed by field name (`consent` too) |
| 429 | `Too many attempts...` or `Please take a moment and try again.` | Limits: 8 a minute and 40 an hour per address, or submitted faster than 1.5 s after the token was issued |
| 503 | `This form isn't available right now.` | Turnstile asked for but not configured |

#### `GET /api/form-intake/:id/count`: the public count

For a petition's progress bar. It answers only for a form whose owner switched on **Show the count** (**Petition** group on the form); otherwise `404`.

```bash
curl -i https://voidslate.localhost/api/form-intake/1/count
```

```json
{ "count": 1, "goal": 100 }
```

The number is kept for 10 seconds on the server and sent with `Cache-Control: public, max-age=10`, so a page loaded by thousands of people at once
costs the database one query every few seconds. It includes the form's **count offset** (a number added to the real total) and is limited to 120 requests a minute per address.
Forms set to **one signature per person** count each address once: signing a second time stores nothing.

### Reading answers (signed in)

```bash
curl -g -H "Authorization: JWT $TOKEN" "https://polysite.localhost/api/form-submissions?where[form][equals]=1&depth=0"
```

Each submission has `submissionData` (`[{ "field": "email", "value": "..." }]`), a `consent` record (what was shown, whether it was ticked, when),
and `expiresAt` from the form's retention setting. `GET /api/form-export/:id` downloads a form's submissions as CSV, and takes `from` and
`to` (`2026-10-01`) to limit the dates; it needs a session and the permission to read that form's submissions (401 or 403 otherwise).

```bash
curl -H "Authorization: JWT $TOKEN" "https://polysite.localhost/api/form-export/1?from=2026-10-01" -o signups.csv
```

## Search

The **search** plugin adds one public route, on the CMS:

```bash
curl "https://polysite.localhost/api/site-search?domain=voidslate.localhost&q=housing&lang=en&page=1"
```

```json
{ "q": "housing", "tooShort": false, "lang": "en", "page": 1, "perPage": 10, "total": 2, "totalPages": 1,
  "results": [{ "id": 1, "collection": "posts", "type": "post", "title": "A plain-language guide to our housing plan", "path": "news/a-plain-language-guide-to-our-housing-plan", "snippet": "..." }] }
```

`domain` and `q` are required; `lang` and `page` are optional. It finds only live pages and posts of that one site, by title, address
and body text. A query shorter than the minimum answers `"tooShort": true` with no results; a site that has not switched search on answers `404`.
Limited to 30 searches a minute per address (`429` with `retryAfter`). See [Search](/guide/search).

## Redirects

`/api/redirects`: `fromPath` (no leading slash), `redirectType` (`internal` or `external`), `toTarget` (a page, file or form) or `toUrl`,
`statusCode` (`301` or `302`) and `enabled`. Changing a live page's slug makes a redirect for you.

## GraphQL

`POST /api/graphql` takes `{"query": "...", "variables": {...}}` and serves the same collections with the same access rules, so signed out
you can read published content and nothing else. Send the same `Authorization` header as for REST.
Collections are named in the singular for one document and the plural for a list; mutations are `create`, `update` and `delete` plus the singular name:

```bash
curl -X POST https://polysite.localhost/api/graphql -H "Content-Type: application/json" \
  -d '{"query": "{ Pages(where: {slug: {equals: \"/\"}}, limit: 1) { docs { id title site { domain } } } }"}'
```

```json
{ "data": { "Pages": { "docs": [{ "id": 2, "title": "Home", "site": { "domain": "voidslate.localhost" } }] } } }
```

Other forms that work: `{ Page(id: 1) { title slug } }`, `{ countPages { totalDocs } }`, `{ Media(limit: 1) { docs { id alt url } } }`
(the media collection is `Media` both for one and for many), `mutation { loginUser(email: "...", password: "...") { token exp } }`, and
```graphql
mutation { updatePage(id: 4, data: { title: "New title" }, draft: true) { id title _status } }
```
Introspection is on, so any GraphQL tool can load the schema. A refused field is `null` with an `errors` entry, as REST would answer 403.
The form and search routes above are REST only.

## AI agents (MCP)

The **mcp** plugin serves the [Model Context Protocol](https://modelcontextprotocol.io) at `POST /api/mcp`, so an AI agent can read a site and
edit it. A key acts as the person who owns it; each key also ticks which collections and tools it may use.
Make a key under **Administration → MCP API Keys** (or from the dashboard card), then connect an agent:

```bash
claude mcp add --transport http polysite https://polysite.localhost/api/mcp \
  --header "Authorization: Bearer <the key>"
```

Or speak MCP directly (the reply is a server-sent event stream):

```bash
curl -X POST https://polysite.localhost/api/mcp \
  -H "Authorization: Bearer <the key>" -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
```

The tools are `polysite_describe_blocks`, `polysite_create_page`, `polysite_update_page`, `polysite_publish_page`, `polysite_upload_media`,
`polysite_create_form`, and generic `find`, `create`, `update`, `delete` tools per collection the key allows. The plugin's README is the full guide, including the optional
**AI Editor** role that can write drafts but not publish. Without a valid key the endpoint answers 401 `Unauthorized, you must be logged in to make this request.`

## Other routes

| Route | Does |
| --- | --- |
| `GET /api/health` | Liveness for monitors |
| `POST /api/setup` | The first-run page's route. Refuses as soon as any user exists |
| `POST /api/privacy/requests/:id/find`, `/export`, `/erase` | Carry out a [privacy request](/guide/privacy) (signed in, needs the request's permission) |
| `GET /api/access` | What the current person may do |

## Limits at a glance

| Where | Limit |
| --- | --- |
| Form submission | 8 a minute and 40 an hour per address; body up to 32 KB |
| Form count | 120 a minute per address |
| Search | 30 a minute per address |
| Sign-in | Per-address limit; five wrong passwords lock the account for ten minutes |
| Uploads | 25 MB by default (`POLYSITE_MAX_UPLOAD_MB`) |

The per-address limits count the address the proxy forwards, so keep the CMS port closed to the world and let only the proxy reach it ([Securing an install](/guide/security)).
