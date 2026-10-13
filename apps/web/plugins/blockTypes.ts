import { createBlockTypes } from "../utils/blockTypes";

// The block types plugin web layers add to the page builder (see utils/blockTypes.ts). A layer's own Nuxt plugin declares
// `dependsOn: ["block-types"]` and calls `nuxtApp.$blockTypes.register(...)`.
export default defineNuxtPlugin({
  name: "block-types",
  setup() {
    return { provide: { blockTypes: createBlockTypes() } };
  },
});
