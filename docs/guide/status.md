# Status and roadmap

Polysite is **pre-1.0** and in active development.

## Verified end to end

Multisite data model, dynamic roles, the page builder with Live Preview, drafts, version
history and scheduled publishing, media, SEO, forms, privacy and consent, redirects, per-site
themes, the plugin system (each plugin owning its own tables), backups and first-run setup.
The plugins for sign-in security (single sign-on, two-factor, API keys), languages, search,
share buttons, news and analytics have end-to-end checks in the plugin test run; email and
notifications have unit tests only. The security review's fixes have a regression check
(`tests/e2e/security.e2e.mjs`).

## Newer, with narrower checks

- The **webhooks** and **WordPress import** plugins have unit tests and their own end-to-end
  scripts, but are not yet part of the full plugin run (`tests/e2e/run-with-plugins.sh`).
- The release and deploy scripts (`deploy/deploy.sh` and the release workflow) are new and have not yet been used
  for a real release or deploy; [Releases and versions](/guide/releasing) and [Deploying](/guide/deploying)
  describe them. Treat the first real release and deploy as their test.
- The `polysite` command-line tool (aliases `polysites` and `poly`) is in preview in a separate
  repository. It is not released and has not been run against a real stack.

## Not built yet

- Redis-buffered petition intake. Redis is provisioned but not yet wired in.
- A multi-step approval workflow. A draft can be marked *ready for review*, but nothing makes
  anyone's approval required before it is published beyond the publish permission.
- The layout of a page differing between languages.

The current, detailed list is kept in the
[architecture guide](/architecture#not-yet-built-by-design-per-the-rollout-plan).

## License

Polysite is source-available under the **Polysite Source-Available License,
version 1.0**. It is not open source. In short, you may use and modify it for your
own internal business purposes (including any number of websites you or your
company own) or for non-commercial use, and share it free of charge for
non-commercial purposes. Selling it, offering it to others as a hosted or
managed service, or running it for third parties for a fee needs a separate
written agreement, and the Polysite name and logo are not licensed for your own
use. The license text governs.

Themes and plugins you build for Polysite may be shared free of charge, including
through a community directory if the licensor offers one. For now they may not be
sold. You keep ownership of what you add. Section 6 of the license has the details.
