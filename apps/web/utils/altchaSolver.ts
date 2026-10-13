// The visitor's half of the ALTCHA bot check (the server's half is apps/cms/src/forms/altcha.ts).
// The server sends a puzzle: find the number n for which SHA-256(salt + n) equals the given
// challenge. Doing that takes the browser a second or so, in the background, and proves a
// real browser spent that effort. The answer goes back with the submission.

export interface AltchaChallenge {
  algorithm: "SHA-256";
  challenge: string;
  maxnumber: number;
  salt: string;
  signature: string;
}

const BATCH = 500;

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Solves the puzzle. Returns the base64 answer to send, or null if it can't be solved here
 * (no Web Crypto, or the signal was aborted). Checks hashes in batches so the page stays responsive.
 */
export async function solveChallenge(c: AltchaChallenge, signal?: AbortSignal): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  for (let start = 0; start <= c.maxnumber; start += BATCH) {
    if (signal?.aborted) return null;
    const end = Math.min(start + BATCH - 1, c.maxnumber);
    const hashes = await Promise.all(Array.from({ length: end - start + 1 }, (_, i) => sha256Hex(c.salt + (start + i))));
    const hit = hashes.indexOf(c.challenge);
    if (hit >= 0) {
      return btoa(JSON.stringify({ algorithm: c.algorithm, challenge: c.challenge, number: start + hit, salt: c.salt, signature: c.signature }));
    }
  }
  return null;
}
