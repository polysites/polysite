# Requirements and support matrix

What Polysite is built and tested against. "Tested" means a run of the project's own checks (the CI workflow, the smoke test, the end-to-end
scripts) or a hand check by the maintainers; where something has not been tested, this page says so.

## To run it

| What | Version | Where it comes from | Notes |
| --- | --- | --- | --- |
| Docker Compose | v2 (`docker compose`) | Docker Desktop, or Docker Engine with the Compose plugin | Compose v1 (`docker-compose`) is not supported. The test scripts use `!reset` and `!override`, which need Compose 2.24 or newer, so use at least that. Tested with Docker Engine 28 and Compose 2.38 (Docker Desktop on Windows 11) and with the Docker that GitHub's `ubuntu-latest` runners carry |
| Node.js | 24 (LTS) | Inside the images (`node:24-alpine`) | You never install it: everything runs in containers. Only a no-containers install (see the bare-metal guide) needs your own Node, and then it must be 24 (the public site's framework needs 22.19 or newer, or 24.11 or newer) |
| PostgreSQL | 16 | `postgres:16-alpine` in the local stack; a managed 16 in production | Another major version is untested. The backup tool's client must match the server's major version: set `POSTGRES_MAJOR` (default 16) and rebuild the backup image |
| Redis | 7 | `redis:7-alpine` | Provisioned, but nothing reads or writes it yet. Pin the version on purpose: later Redis releases changed licence |
| Caddy | 2 | `caddy:2-alpine` | Any other reverse proxy works if it does what the Caddyfile does; see the proxy guide |
| Processor | amd64 and arm64 | Release images are built for both; CI builds amd64 | arm64 images are built on release but not exercised by the automated tests |
| Memory and disk | about 5 GB of disk for the images; a few GB of memory for Docker | | Measured on a development machine, not a sizing guide: size a server by watching it |

## To use it (browsers)

Polysite's own automated tests drive the API and the rendered HTML; **no browser is started by CI or the end-to-end scripts**, so no browser is
"covered by the test suite". By hand, the maintainers have used the admin and the public site in **Chromium** (Chrome and Edge are built on it)
and run an automated accessibility scan in it. Firefox and Safari are **not tested**; the admin is Payload's and the public site is a standard
server-rendered Nuxt app with no browser-specific code, so they are expected to work, but nobody has checked.

| | Public site | Admin |
| --- | --- | --- |
| Chromium family (Chrome, Edge) | Hand-checked, current version | Hand-checked, current version |
| Firefox, Safari | Not tested | Not tested |
| Older browsers, Internet Explorer | Not supported | Not supported |

The admin is English only and is designed for a desktop or laptop screen; the sidebar becomes a drawer on a phone, but long editing sessions on a phone
are not what it is designed for. The admin works to the level the accessibility pass reports: see [Status and roadmap](/guide/status) for open
items.

## Telemetry

Polysite sends **no telemetry**: nothing in it reports usage, errors or the existence of your install to the project or to anyone else. The usage reporting that
Next.js, Nuxt and Payload switch on by default is turned off (`NEXT_TELEMETRY_DISABLED=1` and `NUXT_TELEMETRY_DISABLED=1` in the images, `telemetry: false` in the
Payload config), as is npm's update check in the CMS image, and the admin and the built-in error pages load no font, script or image from another site. This was checked, not assumed: a packet capture of a fresh
production-parity stack (boot, first-run setup, the smoke test with a page, a form and a redirect, the admin and public pages opened in Chromium, then
about two minutes idle) showed no connection to any address outside the Docker network. The first capture, before the fixes above, did catch Payload's
reports to its own telemetry host and npm's registry check, which is why they are off. Not covered: image build time (the same variables apply), the
plugins that call out by design, and a long-running install beyond those two minutes.

What does call out, only because you set it up: OpenTelemetry to the collector you name (`OTEL_EXPORTER_OTLP_ENDPOINT`), the email, webhook and
notification plugins to the destinations you configure, the optional Cloudflare Turnstile check, a site's own Google Fonts address, and any script you
paste into a site. See [Privacy and consent](/guide/privacy).

## Logs

Every service in the compose files keeps at most five log files of 10 MB (50 MB), then drops the oldest, so a long-running server does not fill its disk
with container logs. Application logs can contain email addresses and visitors' addresses; see [Privacy and consent](/guide/privacy).
