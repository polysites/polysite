// @nuxt/eslint generates .nuxt/eslint.config.mjs from this project's own
// Nuxt setup (auto-detects Vue/TS rules); this file extends that generated
// base with the accessibility plugin. Not yet verified against a real
// `npx eslint .` run — Docker was unresponsive while this was written, so
// treat the exact shape here as a strong starting point to confirm, not a
// guaranteed-correct config.
import withNuxt from "./.nuxt/eslint.config.mjs";
import vueA11y from "eslint-plugin-vuejs-accessibility";

export default withNuxt().append(vueA11y.configs["flat/recommended"]);
