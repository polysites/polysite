// Shared slug/path normalization for Pages.slug and Redirects.fromPath --
// keeps the two collections' URL-segment formatting rules identical rather
// than drifting independently. Preserves internal "/" (nested slugs like
// "about/team" are a real, existing shape -- see Pages.ts) by normalizing
// each segment on its own instead of treating the whole value as one token.
// Slug for a duplicated page: "about" -> "about-copy", then "about-copy-2"...
// The homepage slug "/" has no name of its own, so it becomes "home-copy".
// `exists` is injected so this stays a pure, testable function.
export async function nextFreeCopySlug(slug: string, exists: (candidate: string) => Promise<boolean>): Promise<string> {
  const base = `${slug === "/" || slug === "" ? "home" : slug.replace(/^\/+|\/+$/g, "")}-copy`;
  if (!(await exists(base))) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export function normalizeSlug(value: string): string {
  const trimmed = value.trim();
  // "/" is the homepage's own sentinel slug (see pages/index.vue and this
  // file's own special-casing of it elsewhere -- pageHref in
  // usePayloadPage.ts). Stripping leading/trailing slashes unconditionally
  // turns it into "", silently corrupting the homepage on its very next
  // save -- confirmed for real: a homepage resave (even one not touching
  // slug at all) emptied Pages.slug and 404'd the site's root URL.
  if (trimmed === "/") return "/";

  return trimmed
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .map((segment) =>
      segment
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .join("/");
}
