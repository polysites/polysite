// A link target an editor typed that will be rendered as an href on the public
// site. Only same-site paths and http(s) URLs are allowed, so a pasted
// `javascript:` or `data:` address can never become a clickable link.
export function isSafeLinkUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  if (v.startsWith("//")) return false;
  if (v.startsWith("/")) return true;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Payload field validator for an optional link. */
export const validateLinkUrl = (value: string | null | undefined) =>
  !value || isSafeLinkUrl(value) || "Use a full https:// address, or a path starting with /.";
