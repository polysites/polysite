// `serverURL` (needed for absolute password-reset links) makes Payload emit
// absolute upload URLs on the CMS host. The public site is a different
// origin with `img-src 'self'`, so those images were blocked by CSP. The
// site reaches the CMS through its own `/api/*` Caddy route, so a bare path
// resolves correctly there, in the admin, and in Live Preview.
export function toPath(url: unknown): unknown {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return url;
  try {
    const { pathname, search } = new URL(url);
    return pathname + search;
  } catch {
    return url;
  }
}

type UploadDoc = {
  url?: unknown;
  thumbnailURL?: unknown;
  sizes?: Record<string, { url?: unknown } | undefined>;
};

export function relativizeUploadUrls<T extends UploadDoc>(doc: T): T {
  if (!doc || typeof doc !== "object") return doc;
  doc.url = toPath(doc.url);
  doc.thumbnailURL = toPath(doc.thumbnailURL);
  for (const size of Object.values(doc.sizes ?? {})) {
    if (size) size.url = toPath(size.url);
  }
  return doc;
}
