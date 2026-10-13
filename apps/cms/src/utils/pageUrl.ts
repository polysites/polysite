import type { PayloadRequest } from "payload";

// The public URL of a Page, built from the page's own Site (not the global
// SITE_DOMAIN env var, which is just the first dev site) so the SEO preview
// and Live Preview point at the right host on a multisite install.
export function buildPageUrl(domain: string, slug: unknown, scheme = "http"): string {
  const base = `${scheme}://${domain}`;
  const path = typeof slug === "string" ? slug.replace(/^\/+/, "") : "";
  return path ? `${base}/${path}` : base;
}

export async function pageUrlFromDoc(
  doc: { site?: unknown; slug?: unknown } | undefined,
  req: PayloadRequest | undefined,
): Promise<string> {
  const scheme = process.env.SITE_SCHEME || "http";
  const ref = doc?.site;
  const siteId = ref && typeof ref === "object" ? (ref as { id?: unknown }).id : ref;

  let domain = process.env.SITE_DOMAIN || "localhost";
  if (siteId && req?.payload) {
    const site = await req.payload
      .findByID({ collection: "sites", id: siteId as number | string, depth: 0, overrideAccess: true })
      .catch(() => null);
    if (site?.domain) domain = site.domain;
  }
  return buildPageUrl(domain, doc?.slug, scheme);
}
