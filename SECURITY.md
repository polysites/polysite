# Security policy

Polysite manages the public websites and the editor accounts of the
organizations that run it, so we take security reports seriously and want to
hear about them.

## Reporting a vulnerability

**Please don't open a public issue, pull request or discussion for a security
problem.** Report it privately instead.

**Preferred: GitHub private vulnerability reporting.**

1. Go to the [Security tab](https://github.com/polysites/polysite/security)
   of this repository.
2. Choose **Report a vulnerability** and fill in the form.

That creates a private conversation visible only to you and the maintainers, and lets us
collaborate on a fix and request a CVE.

**Fallback, if that option is not available to you:** email
**info@quicksupporttoday.com** with the details, and put "Polysite security" in the
subject. Do not post details in a public place, and do not send secrets or personal data you
do not have to.

A useful report includes:

- what is affected (a collection, an endpoint, the admin UI, a plugin or theme);
- the steps to reproduce it, or a short proof of concept;
- what an attacker gains: for example reading another site's content, editing
  without the right role, or running a script in a visitor's browser;
- the version or commit you tested, and your setup if it matters.

## What to expect

- We aim to acknowledge a report within a few working days and to keep you
  informed as we investigate.
- If the report is valid, we will work on a fix and agree a disclosure date with
  you. We ask that you keep the details private until a fix is available.
- We will credit you in the release notes if you would like that.

Polysite is maintained by a small team, so these are good-faith targets, not
guarantees.

## Supported versions

Polysite is **pre-1.0**. Security fixes go to the current `main` branch and to
the most recent tagged release. Please reproduce a problem on `main` before
reporting it.

## Scope

In scope: the code in this repository, and the plugins and themes published
alongside it (`polysite-plugins`, `polysite-theme-*`). We are particularly
interested in:

- **access-control bypasses**: a user reading or changing another site's data,
  or using a capability their role doesn't grant;
- **authentication and session** weaknesses, including password reset;
- **injection and cross-site scripting**, including through page content,
  per-site custom CSS/JS and form submissions;
- **server-side request forgery** through the outgoing requests an administrator can
  configure: the notifications and webhooks plugins' destinations, single sign-on
  discovery, and the WordPress importer's image downloads;
- **secret handling**: anything that exposes the encrypted SMTP or webhook
  credentials.

Out of scope:

- problems that need an already-authorized Super Admin acting maliciously (they
  can already do anything, by design);
- the demo accounts and passwords created by `seedDevData.ts`. They exist only
  for local development and must never be used on a real deployment;
- findings in third-party software (Payload, Nuxt, Next.js, PostgreSQL, Caddy)
  that Polysite doesn't make worse. Report those to their own projects;
- denial-of-service through sheer traffic volume, and automated-scanner output
  with no demonstrated impact.

## Testing guidelines

Please test only against a copy you run yourself, never against someone else's
live site or data. Don't read, change or delete data that isn't yours, and
stop as soon as you've shown the problem exists.

## Running Polysite securely

If you operate an installation:

- generate a strong, unique `PAYLOAD_SECRET` (and the other secrets in `.env.example`) and
  keep `.env` out of version control and backups you don't control. With HTTPS on, the CMS
  refuses to start on placeholder or short secrets;
- serve everything over HTTPS (set `SITE_SCHEME` and `CMS_SCHEME` to `https`). Over HTTPS the
  first administrator can only be created with `POLYSITE_SETUP_TOKEN`, so set one before the
  server is reachable;
- never run the dev seed script against a production database;
- encrypt backups that leave the machine (`BACKUP_ENCRYPTION_PASSPHRASE`);
- keep Polysite and its container images up to date.

[Securing an install](docs/guide/security.md) lists every setting and limit, and what is
and is not protected.
