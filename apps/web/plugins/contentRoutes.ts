import { createContentRegistry } from "../utils/contentRoutes";

// The registry content-type plugin layers register their routes into (see utils/contentRoutes.ts). A layer's own
// Nuxt plugin declares `dependsOn: ["content-routes"]` and calls `nuxtApp.$contentRoutes.register(...)`.
export default defineNuxtPlugin({
  name: "content-routes",
  setup() {
    return { provide: { contentRoutes: createContentRegistry() } };
  },
});
