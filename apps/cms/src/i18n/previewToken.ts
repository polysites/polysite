// Signs the link that lets an editor see a language the site has set to "preview only". The web app verifies it (apps/web/utils/previewLanguage.ts, the same
// code and format): `?_pl=<language>.<expiry seconds>.<hex HMAC>`, bound to the host and the language, valid for a few hours, made with
// REVALIDATE_SECRET, which the CMS and the web app already share. The page it opens is never cached or indexed.
export const PREVIEW_PARAM = "_pl";
export const PREVIEW_HOURS = 12;

const encoder = new TextEncoder();

async function mac(secret: string, host: string, language: string, expires: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`polysite-language-preview|${host.toLowerCase()}|${language}|${expires}`)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signPreview(secret: string, host: string, language: string, now = Date.now()): Promise<string> {
  const expires = Math.floor(now / 1000) + PREVIEW_HOURS * 3600;
  return `${language}.${expires}.${await mac(secret, host, language, expires)}`;
}

/** The language the token opens for this host, or null when it is missing, malformed, expired or not signed with this secret. */
export async function verifyPreview(secret: string, host: string, token: unknown, now = Date.now()): Promise<string | null> {
  if (!secret || typeof token !== "string") return null;
  const match = /^([A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)\.(\d{1,12})\.([0-9a-f]{64})$/.exec(token);
  if (!match) return null;
  const [, language, expiry, given] = match;
  const expires = Number(expiry);
  if (expires * 1000 < now) return null;
  const expected = await mac(secret, host, language!, expires);
  // Same length by construction (64 hex); compared without stopping at the first difference.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given!.charCodeAt(i);
  return diff === 0 ? language! : null;
}
