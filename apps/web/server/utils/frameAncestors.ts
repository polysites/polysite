// Which origin may put the public site in a frame: the CMS's admin, for Live Preview. It has to be read when the server STARTS, not
// when the image is built (a published image is built once, with no idea which domain it will run on), so it is applied by
// server/plugins/frameAncestors.ts from the environment. Plain functions, so it is unit tested without a server.

type Env = Record<string, string | undefined>;

/** The admin's origin ("https://admin.example.org"), or "" when none is configured (then only the site itself may frame its pages). */
export function adminOrigin(env: Env = process.env): string {
  const candidates = [env.NUXT_CMS_ORIGIN, env.NUXT_PUBLIC_CMS_SERVER_URL, env.CMS_DOMAIN ? `${env.CMS_SCHEME || "http"}://${env.CMS_DOMAIN}` : ""];
  for (const raw of candidates) {
    const value = (raw ?? "").trim();
    if (!value) continue;
    try {
      const url = new URL(value.includes("://") ? value : `${env.CMS_SCHEME || "http"}://${value}`);
      if (url.protocol === "http:" || url.protocol === "https:") return url.origin;
    } catch {
      // not a URL: try the next source rather than put a malformed value into a security header
    }
  }
  return "";
}

/** Replaces the frame-ancestors directive of a Content-Security-Policy value (adding it if there is none), keeping everything else. */
export function withFrameAncestors(csp: string, origin: string): string {
  const directive = `frame-ancestors 'self'${origin ? ` ${origin}` : ""}`;
  const parts = csp.split(";").map((p) => p.trim()).filter(Boolean);
  const isFrameAncestors = (p: string) => p.split(/\s+/)[0].toLowerCase() === "frame-ancestors";
  const index = parts.findIndex(isFrameAncestors);
  const kept = parts.filter((p) => !isFrameAncestors(p));
  kept.splice(index >= 0 ? index : kept.length, 0, directive);
  return kept.join("; ");
}
