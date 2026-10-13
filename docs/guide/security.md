# Securing an install

Polysite checks some settings itself and caps some inputs, and leaves the rest to you. This page lists what it does, which
setting changes each behaviour, and what stays your job. It describes the core; each plugin's README says what it adds.
To report a vulnerability, see [SECURITY.md](https://github.com/polysites/polysite/blob/main/SECURITY.md).

Most of the checks below apply only when the install is served over **https** (`SITE_SCHEME=https` or `CMS_SCHEME=https` in
`.env`), because that is the case where a mistake is reachable from the internet. On plain http (local development) they stay
out of the way.

## Secrets: the CMS refuses to start on placeholders

With either scheme set to `https`, the CMS stops at boot with a message naming every problem when:

- `PAYLOAD_SECRET` is missing, still a placeholder (a value copied from `.env.example`, or containing `changeme`, `change-me`,
  `example`, `placeholder` or `password` as a word) or shorter than 32 characters;
- `REVALIDATE_SECRET`, `NUXT_REVALIDATE_SECRET` or `POSTGRES_PASSWORD` is set and has the same problem (they are checked only
  where set, because a managed database has no `POSTGRES_PASSWORD`);
- `CMS_DOMAIN` is empty.

Generate real values with `openssl rand -base64 48`. `POLYSITE_ALLOW_WEAK_SECRETS=1` switches the check off, for a throwaway
staging server only.

`PAYLOAD_SECRET` signs sessions and form tokens and keys everything a plugin stores encrypted (the SMTP password, webhook
secrets, bot-check keys, two-factor secrets). Keep a copy somewhere safe, apart from the backups, and never change it on a running
install: the stored values could no longer be read.

## The first administrator needs a setup token over https

The first-run page and Payload's own first-account route are open until a user exists, so whoever reached a new public server
first would become Super Admin. Over https, the CMS therefore refuses to create the first account unless `POLYSITE_SETUP_TOKEN` is
set; the page then asks for it. Put a token in `.env` before the server is reachable, restart the CMS, and enter it on the setup
page (`openssl rand -base64 32` makes a good one).

- On plain http the token is optional but still used when set.
- `POLYSITE_ALLOW_OPEN_SETUP=1` lifts the requirement for a throwaway server. Do not use it on a real one.
- Once any user exists, the setup page is gone and the token has no further effect.

## Sign-in and password-reset limits

Payload locks one *account* for 10 minutes after 5 wrong passwords (the auth plugin can change those numbers). On top of that,
Polysite limits each *address*, which stops one machine trying many accounts or flooding reset emails:

| Setting | Default | What it limits |
| --- | --- | --- |
| `POLYSITE_LOGIN_RATE_LIMIT` | 20 | Sign-in attempts per address in 10 minutes |
| `POLYSITE_RESET_RATE_LIMIT` | 5 | Password-reset requests per address in 15 minutes |

Past the limit the CMS answers 429 and says to try later. The counts are kept in memory by the one CMS process, so a restart forgets
them, which only ever lets a few extra attempts through. The address is the last entry of `X-Forwarded-For`, the one Caddy adds,
so keep the CMS port unpublished (production does) and, if you put a CDN or another proxy in front, test that visitors still get
their own address. Only sign-in and password-reset requests are limited; the limit is not applied to calls the stack makes to itself.
Unlocking a locked account is a Super Admin action.

## The public site's request cap

The public site (the Nuxt app) counts the pages each address asks for and answers **429 Too Many Requests** past a cap, with a
`Retry-After` header and a short plain page. Static files (`/_nuxt`, images, fonts, icons), the health check and the CMS's publish
webhook are not counted, and the form-intake and search limits (enforced by the CMS) are separate and unchanged.

| Setting | Default | What it does |
| --- | --- | --- |
| `POLYSITE_WEB_RATE_LIMIT` | 600 | Page requests allowed per address in one window. `0` switches the cap off |
| `POLYSITE_WEB_RATE_WINDOW_SECONDS` | 60 | The window, in seconds |
| `POLYSITE_WEB_RATE_LIMIT_OFF` | unset | `1` switches the cap off (for example when a CDN or web application firewall does the limiting) |
| `POLYSITE_WEB_RATE_LIMIT_IP_HEADER` | unset | A request header that carries the visitor's real address. `CF-Connecting-IP` for Cloudflare |
| `POLYSITE_WEB_TRUST_PROXY` | on | `0` ignores `X-Forwarded-For` and counts the connection's own address |

Earlier versions used the library default of 150 requests per 5 minutes per address, which a school, an office or a mobile carrier
behind one shared address could reach within a minute. Raise the number for a site you expect a crowd on; the cost of a high
number is only that one misbehaving address can ask for more pages before it is slowed.

**Which address is counted.** Behind the bundled Caddy (and any proxy that appends the address it saw, such as nginx's
`$proxy_add_x_forwarded_for`) it is the **last** entry of `X-Forwarded-For`, the one the proxy added. A visitor cannot forge it, and it
is the same rule the CMS uses for sign-in limits. That is only safe because the web port (3000) is not published in the production
compose files: keep it that way. If you must expose port 3000 directly, set `POLYSITE_WEB_TRUST_PROXY=0` so the header is ignored.

**Behind a CDN.** The proxy then sees the CDN's address for every visitor, so without a setting everyone behind that edge shares
one count. Name the header your CDN uses for the real address: for Cloudflare, `POLYSITE_WEB_RATE_LIMIT_IP_HEADER=CF-Connecting-IP`.
Trust such a header only when the origin accepts connections from the CDN alone (a firewall rule for the CDN's published ranges),
because anyone who can reach the origin directly could otherwise send any value. A request without the header falls back to
`X-Forwarded-For`. The same applies to the CMS's sign-in limits, which read `X-Forwarded-For`; test that visitors still get their own
address after adding a CDN.

The counts are kept in the memory of the one web process, so a restart forgets them (a few extra requests at most).

## A check on the sign-in page (optional, auth plugin)

With the auth plugin installed, a Super Admin can add a Cloudflare Turnstile check to the admin sign-in and forgot-password pages
(usually no click: the widget just says "Success!"). Create a free widget in the Cloudflare dashboard (Turnstile, *Add widget*,
type *Managed*, your admin's host name), then paste its site key and secret key under **Administration, Sign-in, Sign-in
security, Sign-in protection** and tick *Turn the check on*. The secret is encrypted at rest and never shown again. The CMS asks
Cloudflare to verify every token before it looks at the password or sends a reset email, and refuses the request when the token is
missing or refused or Cloudflare does not answer within 5 seconds (it fails closed).

| Variable | What it does |
| --- | --- |
| `AUTH_TURNSTILE_SITE_KEY`, `AUTH_TURNSTILE_SECRET_KEY` | Both set: the check is on with these keys, and they win over the ones saved in the admin. Use them to protect a fresh install before anyone can sign in to change settings |
| `AUTH_CAPTCHA_OFF=1` | The emergency switch: no check at all, whatever else is set. Use it when Cloudflare cannot be reached or the keys are wrong and nobody can sign in; restart the CMS, sign in, fix the keys, remove the variable |

The check applies to requests that carry a forwarded address, like the limits above, so keep the CMS port unpublished. Calls the stack
makes to itself, API keys and single sign-on are not asked for it. The admin sends no Content-Security-Policy that blocks the widget;
if you add one, allow `https://challenges.cloudflare.com` for scripts and frames.

## Sizes and uploads

| What | Limit | Where it is enforced |
| --- | --- | --- |
| One uploaded file | 25 MB, `POLYSITE_MAX_UPLOAD_MB` changes it | The CMS |
| A form submission | 64 KB | Caddy, on `/api/form-intake/*` |
| Any other API or admin request | 100 MB | Caddy |

If you raise `POLYSITE_MAX_UPLOAD_MB` above 100, raise the `max_size` in the `Caddyfile` too. Uploads are checked by type: HTML,
script and executable files are refused, and an SVG that contains script is refused.

## Headers and cookies

Caddy adds `X-Content-Type-Options: nosniff`, a referrer policy and `Strict-Transport-Security` to everything the CMS answers
(the API and uploaded files), and the admin's domain also gets `X-Frame-Options: DENY` and `frame-ancestors 'none'`, so the admin
cannot be put in a frame on another site. (The HSTS header is ignored on plain http.) The public site's pages get theirs from the
web app (CSP and the usual set), with the admin's origin allowed to frame them so Live Preview works. The session cookie is
`HttpOnly`, `SameSite=Lax`, and `Secure` whenever `CMS_SCHEME=https`.

## Network exposure

- Production publishes ports 80 and 443 only. The database (Cloud SQL through the proxy), Redis and the two apps are reachable
  only inside Docker's network.
- The local `docker-compose.yml` publishes Postgres on `127.0.0.1:5432` (this machine only; its password is a placeholder until you
  edit `.env`). It also sets `no-new-privileges` and drops all Linux capabilities for `cms` and `web`.
- The images run as an unprivileged user and carry health checks.

## Backups hold everything

A backup is the whole database (password hashes, form submissions, encrypted settings) plus the media. Archives are written
readable by their owner only. An off-site copy (`BACKUP_RCLONE_REMOTE`) is **refused unless** `BACKUP_ENCRYPTION_PASSPHRASE` is set
to a strong passphrase (16 characters or more, not a placeholder): nothing is sent, the run fails, the monitoring ping reports it, and the
backup container turns unhealthy. Keep the passphrase apart from the archives. See [Backups and restore](/guide/backups).

## Who can do what

- A **Super Admin** can do anything, by design, including set the SMTP host, webhook destinations and single-sign-on providers.
- A role with **manage site settings** (Site Admin, by default) can add JavaScript that runs for every visitor of that site: the
  site's custom JavaScript (Sites, Advanced) and a "custom" tracking tool in the analytics plugin. It can also set navigation and
  footer links to any address. Give that permission only to people you would trust with the site, and treat the custom CSS the same
  way. A Site User can do none of this.
- Another site's drafts, versions, forms and submissions are not readable by an editor of a different site; the access rules are
  default-deny and are exercised end to end by `tests/e2e/security.e2e.mjs`.
- GraphQL is on, refuses introspection in production, and uses the same access rules as the REST API. Nothing in Polysite uses it.

## Known limits

- The per-address limits, the public site request cap and the form spam limiter (8 submissions a minute, 40 an hour per address) live in the memory of one
  process. That suits the single-server setup; several servers would each count separately.
- Email goes out with opportunistic STARTTLS on ports other than 465, so a network attacker who strips it could capture the SMTP
  credentials. Prefer port 465 (implicit TLS) or a provider on a private path.
- Both compose files set `no-new-privileges` and drop all Linux capabilities for `cms` and `web` (production does the same for
  Caddy, keeping only the one to bind ports 80 and 443). No service runs with a read-only filesystem.
