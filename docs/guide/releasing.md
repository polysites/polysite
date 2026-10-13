# Releases and versions

How Polysite versions work, what a release publishes, and how to take one back. For putting a release on a server, see
[Deploying](/guide/deploying). The short version: **a release is a tag**, the release workflow turns the tag into scanned,
attested images and a *draft* GitHub release, and **nothing reaches a server until someone deploys it on purpose**.

## What a release publishes

- Three container images on `ghcr.io/polysites`: `polysite-cms`, `polysite-web` and `polysite-backup`, tagged `vX.Y.Z` (a stable release also moves
  `vX.Y` and `latest`; a pre-release never does).
- A deployment bundle (`docker-compose.prod.yml`, `Caddyfile`, `.env.example`, `deploy/deploy.sh`), the exact image digests, and an SBOM for each image.
- Build provenance and SBOM attestations for the images and the bundle. Check an image before you run it:
  `gh attestation verify oci://ghcr.io/polysites/polysite-cms:v0.1.0 --owner polysites`.

## Versions

- **Semantic Versioning**, starting at `0.x`. In `0.x` a *minor* release (0.2.0) may change something that affects an existing
  install, and its changelog entry says so under "Upgrade notes". `1.0.0` means the public surface below is stable.
- **The public surface** a version number promises about: the plugin contract (manifest, `apply(config, kit)`,
  `custom.polysite`), the theme contract (layout names, block props, slots and events), environment variables, database
  migrations, the Payload REST and GraphQL API as configured here, and the command-line tools.
- **One version for the core**, written in one place: the `VERSION` file. `apps/cms` and `apps/web` carry the same number in their
  `package.json` and `package-lock.json`, the images carry it as `POLYSITE_VERSION` and in their `org.opencontainers.image.version`
  label, and both apps report it on `/api/health`. the release workflow refuses a tag
  that disagrees with any of them.
- **Pre-releases** are versions with a suffix: `0.2.0-beta.1`, `0.2.0-rc.1`. They are real releases that go through the same
  pipeline, with two differences: they are never tagged `latest`, and they never move the `v0.2` tag either.

## Rolling back

A rollback is a deploy of the previous images, not a release. `deploy/deploy.sh --rollback` puts back what ran before the last
deployment, and a deploy that fails a health gate does the same by itself. What that does to the database, and what to do when a
migration itself must be undone, is in [Deploying](/guide/deploying#rolling-back).

To **withdraw a bad release** that has been published: deploy the previous version, mark the GitHub release as a pre-release or
add a warning to its notes, and ship a fixed patch. Do not delete the tag or the images; deployments, attestations and the audit
log refer to them.

## Plugins and themes

Plugins and themes live in their own repositories and have their own versions (`version` in `polysite.plugin.json` and
`package.json`). A published core image contains **the core only**: themes and plugin web parts are Nuxt layers and plugin admin
components go through Next's import map, so both are fixed at build time. Anyone who uses a theme or plugin builds a derived
image from source and points the compose file at it (`POLYSITE_CMS_IMAGE`, `POLYSITE_WEB_IMAGE`; see `docker-compose.prod.yml`).
The same deploy script then runs it. Its version label is checked against the version you ask for, so label your own build with
`--build-arg POLYSITE_VERSION=<version>`.

**Compatibility.** A plugin can say which core versions it works with, in its manifest:

```json
{ "slug": "search", "label": "Site search", "scope": "per-site", "version": "0.1.0", "requires": { "polysite": ">=0.1.0 <0.3.0" } }
```

The field is optional. The CMS checks it at boot against the running version (`POLYSITE_VERSION`): a plugin that does not fit is
**left out with a message in the log** (`[plugins] search: not loaded: it needs Polysite >=0.1.0 <0.3.0, and this is 0.3.0`),
the same way `POLYSITE_PLUGINS_OFF` leaves one out, and nothing of its data is deleted. The comparators are `>=`, `>`, `<=`, `<` and
`=`, separated by spaces; a pre-release core counts as the release it leads to; a development build accepts every plugin. A plugin
that is left out takes its collections with it, so check the log after an upgrade. Record which plugin versions were tested with
each core release in the plugins repository's changelog; the core's `CHANGELOG.md` notes a plugin-contract change under
"Upgrade notes" whenever there is one.

