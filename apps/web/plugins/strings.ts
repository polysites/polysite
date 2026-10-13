import { createStringRegistry } from "../utils/strings";

// The dictionaries of fixed words (see utils/strings.ts). A theme's or plugin's own Nuxt plugin declares
// `dependsOn: ["strings"]` and calls `nuxtApp.$strings.register("fr", { ... })`.
export default defineNuxtPlugin({
  name: "strings",
  setup() {
    return { provide: { strings: createStringRegistry() } };
  },
});
