# Getting started

This runs the full stack on your machine with demo content. On the maintainers' machine it took about two minutes the first time
and under one minute with cached layers (see [how long it takes](#how-long-it-takes)).

## What you need

- **Docker** with Compose v2 (Docker Desktop on Windows and macOS; Docker Engine with the Compose plugin on Linux) and **Git**.
  Nothing else is installed on your machine: all Node.js work happens inside containers.
- About **5 GB of free disk** for the images, and a few GB of memory for Docker. The tested versions of everything else (Node 24, PostgreSQL 16, Redis 7, browsers) are on the [Requirements](/guide/requirements) page.
- These **ports free**: **80** and **443** (the proxy), **3000** (the site) and **3001** (the CMS), both only for the hot-reload
  dev loop, and **5432** (Postgres, reachable from this machine only). If one is taken, see
  [If a port is taken](#if-a-port-is-taken).

## Run it

```bash
git clone https://github.com/polysites/polysite.git
cd polysite
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

`.env.example` is already set up for a local try-out: the wildcard `SITE_DOMAIN=*.localhost` serves every `<name>.localhost` site
and the admin is at `polysite.localhost`; browsers resolve `*.localhost` on their own. The stack is usable about half a minute
after `up` returns, and the very first page you open takes several seconds more because the dev server compiles it on demand.

Polysite runs on its own. **Themes and plugins are separate repositories** and are optional: without them you get the core's own
neutral theme and no plugins. To add them, clone each next to `docker-compose.yml` into the folder of the same purpose (each is
just a folder, no configuration), then restart:

```bash
git clone https://github.com/polysites/polysite-themes.git themes
git clone https://github.com/polysites/polysite-plugins.git plugins
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Load the fictional demo sites, pages and **dev-only** accounts. The script prints the logins; never use them outside local
development. It refuses a database that already has other users.

```bash
docker compose exec cms npx payload run scripts/seedDevData.ts
```

The demo uses the starter theme when the themes repository is cloned and the core's own theme when it is not
(`docker compose exec -e SEED_THEME=<name> cms ...` picks another). It is safe to run again: a finished seed says so and changes
nothing, and one that stopped half way is completed. To start over, `docker compose down -v` deletes the stack's data.

| What | Where |
| --- | --- |
| Public site | `http://voidslate.localhost` |
| Admin (CMS) | `http://polysite.localhost/admin` |

::: warning Use the Caddy address for the admin
Open the admin through `http://polysite.localhost`, not the direct container
port. The CMS builds its URLs from `CMS_DOMAIN`, and a login made on a different
origin won't carry over.
:::

### How long it takes

Measured on a Windows 11 machine with Docker Desktop and a fast connection, from `up` to a demo page showing: about **110
seconds** with nothing cached (both images built from scratch and every package downloaded; the base images were already
pulled) and about **45 seconds** with cached layers. The admin's login page answers after about 30 seconds of that, and the seed
takes about 10. A slow connection spends the difference downloading packages.

### If a port is taken

Set the host ports in `.env` (all optional, defaults in brackets): `POLYSITE_HTTP_PORT` (80), `POLYSITE_HTTPS_PORT` (443),
`POLYSITE_WEB_PORT` (3000), `POLYSITE_CMS_PORT` (3001) and `POLYSITE_DB_PORT` (5432). If you move the proxy off port 80, put the
same port in the two domains, because the CMS builds its links from them:

```bash
POLYSITE_HTTP_PORT=8080
SITE_DOMAIN=*.localhost:8080
CMS_DOMAIN=polysite.localhost:8080
```

and use `http://voidslate.localhost:8080` and `http://polysite.localhost:8080/admin`. To run a second copy next to another Polysite
stack, also set `COMPOSE_PROJECT_NAME=polysite2` in its `.env`, or the two share containers and volumes.

## Check a production-like build

Before committing a schema change, run a real build with a real migration:

```bash
docker compose up --build
```

## First run on an empty install

On a database with no users, opening the admin takes you to a **setup page** instead of a
login. It asks for:

1. **An administrator account:** email and password. This account becomes the **Super
   Admin**, with full access to every site, user, role and setting. You don't choose a role.
   Polysite has already created the three default roles (Super Admin, Site Admin and Site
   User), and you can add users and edit roles from the admin afterwards.
2. **Your first site:** its name, its domain (without `https://`), its theme, and whether to
   create a starter home page.

Submit it and you are signed in to the admin, with the site live on its domain. The page
works only while no user exists. After that it redirects to the normal login.

If the server is reachable before you get to the page, set `POLYSITE_SETUP_TOKEN` in `.env`
and restart the CMS. The setup page then asks for that token, so only the person who controls
the server can finish setup. **On an https install it is required**: with `CMS_SCHEME=https`
and no token, setup is refused and the page says so. (`POLYSITE_ALLOW_OPEN_SETUP=1` lifts that
for a throwaway server.) See [Securing an install](/guide/security).

Afterwards you sign in with an email and a password. If the authentication plugin is installed,
the sign-in page also shows a button for each single-sign-on provider an administrator has added,
and the authentication code and two-factor setup show up only when needed: for an account that has
two-factor on, or one that must set it up. Anyone can turn two-factor on from their own account
page. Without the plugin the sign-in page is just email and password. If an administrator switched
on the sign-in check (Cloudflare Turnstile), a small widget above Login confirms you are a person,
usually without a click; if it cannot load, the sign-in is refused and the page says so (an
operator can switch the check off, see [Securing an install](/guide/security)).

The demo data script above is optional and for local development only. It creates fictional
sites and accounts, so don't run it against a real install.

## Adding a second site

1. In the admin, create a **Site** with its domain, for example
   `example.localhost`.
2. Create pages for that site. A page belongs to exactly one site.
3. Open `http://example.localhost`. With the wildcard above, no proxy change is
   needed locally.

In production each site's real domain is listed in the proxy configuration so
Caddy can issue its certificate automatically. A wildcard cannot get one.

## Deploying

A release (a version tag) publishes versioned images and deploys nothing. You put a
version on the server on purpose, with a script that takes a backup first, runs the
migrations, switches one service at a time and rolls back by itself if a health check
fails:

```bash
deploy/deploy.sh 0.1.0
```

See [Deploying](/guide/deploying) and [Releases and versions](/guide/releasing). The **Deploy**
workflow runs the same script by hand from GitHub Actions; it needs the repository
secrets `VM_HOST`, `VM_USER` and `VM_SSH_PRIVATE_KEY`. Production runs on a single VM
behind Caddy with a managed PostgreSQL database.

Before a server is reachable from the internet, read [Configuration](/guide/configuration) and
[Securing an install](/guide/security). A command-line tool (`polysite`, also `polysites` and
`poly`) that wraps install, backup and upgrade is in preview in its own repository; it is not
released yet, so use the steps on this page for now.

Next: [what Polysite does](/guide/features), or the [architecture](/architecture)
for how the pieces fit.
