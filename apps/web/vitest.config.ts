import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "composables/**/*.test.ts",
      "utils/**/*.test.ts",
      "server/utils/**/*.test.ts",
      // A plugin's web part (a Nuxt layer) keeps its tests beside its code.
      path.resolve(__dirname, "../../plugins/*/web/**/*.test.ts"),
    ],
  },
});
