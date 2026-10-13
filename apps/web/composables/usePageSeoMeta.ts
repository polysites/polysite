import type { Ref } from "vue";
import type { PayloadPage } from "../types/payload";

// The SEO plugin's `meta.title`/`meta.description`/`meta.image` fields on
// Pages were real, populated fields that nothing on the frontend ever read --
// only the plain `title` field made it into <head>, via a bare useHead call.
// Currently latent (no page has meta fields set yet) but the exact same
// silent-drop defect class as Hero.image once one does. Shared between
// index.vue and [...slug].vue since both need the identical fallback chain:
// SEO plugin's own meta field first, then the page's own title/generated
// default, matching how the plugin's `generateTitle` already behaves in the
// admin.
export function usePageSeoMeta(livePage: Ref<PayloadPage | undefined>, fallbackTitle: string) {
  const requestUrl = useRequestURL();

  useSeoMeta({
    title: () => livePage.value?.meta?.title || livePage.value?.title || fallbackTitle,
    description: () => livePage.value?.meta?.description || undefined,
    ogTitle: () => livePage.value?.meta?.title || livePage.value?.title || fallbackTitle,
    ogDescription: () => livePage.value?.meta?.description || undefined,
    // Open Graph crawlers need an absolute URL; Payload's upload `url` is
    // relative (e.g. /api/media/file/x.webp).
    ogImage: () => {
      const url = livePage.value?.meta?.image?.url;
      return url ? `${requestUrl.origin}${url}` : undefined;
    },
  });
}
