# Compose behind your own reverse proxy

The reference stack puts Caddy in front of the apps. If your organisation runs Apache, nginx or Traefik, keep everything else
([Deploying](/guide/deploying): the compose file, the deploy script, backups) and replace Caddy. The files are in
[`proxy/`](https://github.com/polysites/polysite-deploy/tree/main/proxy). Each one reproduces what the `Caddyfile` does:

| Request | Goes to | Extras |
| --- | --- | --- |
| Site domain, `/api/media/file/*` | CMS | `Cache-Control: public, max-age=86400`, API headers |
| Site domain, `/api/form-intake/*` | CMS | body capped at **64 KB**, chunked bodies included; API headers |
| Site domain, `/api/*` | CMS | body capped at **100 MB** (100,000,000 bytes); API headers |
| Site domain, anything else | Web app | none (the web app sets its own headers, including the CSP that lets the admin frame it for Live Preview) |
| Admin domain, `/` | redirect to `/admin` | admin headers |
| Admin domain, anything else | CMS | admin headers, 100 MB cap |

API headers are `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and
`Strict-Transport-Security: max-age=31536000; includeSubDomains`. Admin headers add `X-Frame-Options: DENY` and
`Content-Security-Policy: frame-ancestors 'none'`. There is no websocket: the admin and Live Preview do not use one.
The web app serves its own scripts, styles and fonts, so unlike Caddy the other proxies need no shared static volume.

## What the proxy must also get right

- **The visitor's address.** The CMS limits sign-ins per address and reads it from the **last** entry of `X-Forwarded-For`. The proxy
  must append the address it saw to whatever the client sent (nginx, Apache and Traefik all do; the tests send forged headers to prove it).
  If another proxy or a CDN sits in front, check that visitors still get their own address, or one person's wrong passwords will lock everybody out.
- **Never publish ports 3000 or 3001.** Use the Docker network, or loopback only ([`docker-compose.hostproxy.yml`](https://github.com/polysites/polysite-deploy/blob/main/proxy/docker-compose.hostproxy.yml)).
- **`X-Forwarded-Proto: https`** so the apps build `https` links; set `SITE_SCHEME=https` and `CMS_SCHEME=https` in `.env` as usual.

## nginx

```bash
# edit the two domains (and the upstreams if nginx is not in the stack's Docker network) in proxy/nginx/polysite.conf
docker compose --env-file .env --env-file .deploy/current.env \
  -f docker-compose.prod.yml -f proxy/nginx/docker-compose.nginx.yml up -d
```

The override moves Caddy behind a profile so it does not start (needs Docker Compose 2.24 or newer). For HTTPS, get certificates with
certbot (`certbot certonly --webroot -w /var/www/certbot -d <domain>` for each domain, with the plain-http file running), then switch the
volume to `polysite-tls.conf` and mount `/etc/letsencrypt`. On a host-installed nginx, copy the file to `/etc/nginx/conf.d/`, point the two
`upstream` blocks at `127.0.0.1:3001` and `:3000`, and add `docker-compose.hostproxy.yml` to the compose command.
Known difference: nginx cannot remove its `Server` header, only the version.

## Apache httpd

Modules: `proxy`, `proxy_http`, `headers`, `rewrite` (plus `ssl` and `http2` for HTTPS). On Debian or Ubuntu:

```bash
a2enmod proxy proxy_http headers rewrite ssl http2
cp proxy/apache/polysite.conf /etc/apache2/sites-available/ && a2ensite polysite   # polysite-tls.conf for HTTPS
```

or run the container with `proxy/apache/docker-compose.apache.yml` (add `-DTLS` to its command for HTTPS). **A finding from testing:
Apache's `LimitRequestBody` is not applied to a proxied request** (a 5 KB body passed a 1,000-byte limit), so the shipped file checks the declared
`Content-Length` with rewrite rules and **refuses chunked request bodies with 411**, which browsers never send for forms or uploads.
If a client of yours streams chunked uploads, cap them with mod_security or put nginx or Caddy in front. Certificates: certbot, or mod_md (not tested here).

## Traefik

Two forms, both tested. `docker-compose.traefik-file.yml` routes from `dynamic/polysite.yml` and needs no Docker socket; `docker-compose.traefik.yml`
routes from labels on the cms and web services and mounts the Docker socket read-only (root-equivalent on the host: use a socket proxy if that matters).
Certificates come from Traefik's built-in Let's Encrypt resolver; set your e-mail in `traefik.yml` or `ACME_EMAIL`.

```bash
ACME_EMAIL=you@example.org docker compose --env-file .env --env-file .deploy/current.env \
  -f docker-compose.prod.yml -f proxy/traefik/docker-compose.traefik.yml up -d
```

## Backups, upgrades, rollback

Unchanged: the proxy holds no state. `deploy/deploy.sh` keeps working but only knows the compose file it is given, so pass the proxy's override with
`--compose-file docker-compose.prod.yml --compose-file proxy/<proxy>/docker-compose.<proxy>.yml`. Caddy-specific state (the `caddy-data` volume) is simply unused;
nginx and Apache keep their certificates under `/etc/letsencrypt` on the host (back that folder up or re-issue), Traefik in the `traefik-acme` volume.

## Health checks and monitoring

Point an uptime monitor at `https://<admin domain>/api/health` and a public page. For the proxy itself use its own: `nginx -t` and `apachectl configtest` before a reload,
`docker compose logs --tail 50 <proxy>`.

## Secrets, TLS and hardening

Secrets stay in `.env` (mode 600). TLS 1.2 and 1.3 only are configured in the HTTPS files (tested: 1.0 and 1.1 are refused, HTTP/2 is offered). The proxy containers run
with `no-new-privileges` and all capabilities dropped except the few they need. Then follow the [security checklist](/guide/security).

## Tested

`proxy/test/run.sh all` starts a throwaway stack per proxy and runs the whole first-run smoke test through it, then `checks.mjs`: the headers
above, `/` redirect, an upload with a space in its name and its cache header, 64 KB and 100 MB caps (sized and chunked, and that the refusal comes from the proxy,
not the app), a forged `X-Forwarded-For` against the sign-in limit, unknown hosts. The HTTPS modes check the redirect, HSTS, `X-Forwarded-Proto`, TLS versions and HTTP/2
against a self-signed certificate. **Not tested:** getting a real Let's Encrypt certificate (needs the internet and real DNS).

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Everyone gets "too many sign-in attempts" | The CMS sees one address for all visitors: the proxy in front is not forwarding the visitor's address as the last `X-Forwarded-For` entry |
| Live Preview shows a blank frame | The site's CSP `frame-ancestors` does not list the admin origin ([Known Issue #71](/architecture)) or the proxy adds `X-Frame-Options` to site pages |
| 413 on an upload | The file is over the proxy cap (100 MB) or `POLYSITE_MAX_UPLOAD_MB` (25 by default, enforced by the CMS) |
| Apache returns 411 | The client sent a chunked body; send a `Content-Length` |
| 502 from the proxy | The apps are not up yet (`docker compose ps`) or the upstream names do not resolve from where the proxy runs |
