// Lints the web part of each plugin (plugins/<name>/web, a Nuxt layer). The app's own config comes from Nuxt's
// generated one, which only knows the app's directories, so plugin layers get this smaller config instead: the same
// Vue and accessibility rules, with TypeScript parsing. Run it from the repository root (`npm run lint:plugins`).
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import vue from "eslint-plugin-vue";
import vueA11y from "eslint-plugin-vuejs-accessibility";

export default [
  { ignores: ["**/node_modules/**"], linterOptions: { reportUnusedDisableDirectives: "off" } },
  ...vue.configs["flat/essential"],
  ...[].concat(vueA11y.configs["flat/recommended"]),
  {
    files: ["**/*.ts"],
    languageOptions: { parser: tsParser },
    // Registered so a file's own `eslint-disable @typescript-eslint/...` comments name a rule that exists.
    plugins: { "@typescript-eslint": tsPlugin },
  },
  {
    files: ["**/*.vue"],
    languageOptions: { parserOptions: { parser: tsParser } },
  },
];
