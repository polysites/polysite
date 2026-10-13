import { createSiteSlots } from "../utils/siteExtensions";

// The slots plugin web layers fill (see utils/siteExtensions.ts). A layer's own Nuxt plugin declares
// `dependsOn: ["site-extensions"]` and calls `nuxtApp.$siteSlots.add("app", Component)`.
export default defineNuxtPlugin({
  name: "site-extensions",
  setup() {
    return { provide: { siteSlots: createSiteSlots() } };
  },
});
