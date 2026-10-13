// Webhook target for Payload: call this on every page publish/update so the
// public site reflects the change quickly instead of waiting out the isr
// cache's normal lifetime.
//
// This clears Nitro's whole route cache rather than just the one changed
// path. Nuxt/Nitro doesn't expose a stable, version-independent API for
// purging a single cached route by path the way Next.js's on-demand ISR
// does — clearing the full cache is the honest, simple mechanism for now.
// For a low-traffic multisite CMS this is cheap (pages just re-render on
// next request); revisit if per-path purging becomes worth the added
// complexity once traffic grows.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const providedSecret = getHeader(event, "x-revalidate-secret");

  if (!config.revalidateSecret || providedSecret !== config.revalidateSecret) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  await useStorage("cache").clear();

  return { revalidated: true };
});
