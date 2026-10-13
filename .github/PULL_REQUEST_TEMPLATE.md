## What and why

<!-- What changed, and why. Link the issue it closes, if any. -->

## Checklist

- [ ] **Tests:** I added or updated tests, and ran `docker exec polysite-cms-1 sh -c "cd /repo/apps/cms && npm run lint && npm test"` and the same for `apps/web`.
- [ ] **Docs:** I updated the guides or READMEs that describe what I changed (and the changelog, if it is user-visible).
- [ ] **Schema change?** I generated a migration (see CONTRIBUTING.md, "Schema changes") and `npm run check:migrations` and `npm run check:plugin-isolation` pass in `apps/cms`. (`sh scripts/pluginMigrations.sh check` is the plugin-isolation check.)
- [ ] **Access control** still fails closed: a new collection is registered in `apps/cms/src/rbac/modules.ts` and goes through `hasCapability`, with a unit test.
- [ ] Nothing in `apps/` requires a plugin or a theme; the core still builds and runs without `plugins/` and `themes/`.
- [ ] I tried the change in a real browser (hydration, navigation and stacking bugs do not show up in `curl`).
- [ ] **No secrets or personal data:** no passwords, tokens, keys or real people's details in the code, tests, fixtures, logs or screenshots.
- [ ] I read CONTRIBUTING.md in the core repository, including the contribution terms.

## How I checked it

<!-- Commands run, pages clicked through, screenshots for anything visual. -->
