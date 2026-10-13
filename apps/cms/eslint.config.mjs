// eslint-config-next ships native ESLint 9 flat configs directly -- no
// FlatCompat/legacy-extends shim needed (and the shim actively breaks here:
// routing these through FlatCompat.extends() threw "Converting circular
// structure to JSON" from eslint-plugin-react's flat preset, confirmed by
// inspecting node_modules/eslint-config-next/dist/core-web-vitals.js, which
// already exports a plain flat-config array).
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: ["src/payload-types.ts"],
  },
  {
    rules: {
      // Underscore-prefixed is this repo's convention for a deliberately
      // unused binding (e.g. destructuring a key off an object just to
      // drop it -- see Pages.ts's stripIds), not a mistake to flag.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default config;
