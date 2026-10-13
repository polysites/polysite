import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

// ALTCHA: a bot check with no third party and nothing for the visitor to do. The
// server hands out a puzzle (find the number that hashes to a given value); the
// visitor's browser solves it in the background in a second or so; the server checks
// the answer. A person never notices; a bot sending thousands of submissions has to
// pay that cost for each one. It follows ALTCHA's published challenge format.
//
// Each puzzle is signed by the server (so it can't be made up), tied to one form,
// expires, and can be used once (so a solved puzzle can't be replayed).

export const CHALLENGE_MAX_NUMBER = 50_000;
export const CHALLENGE_LIFETIME_MS = 10 * 60_000;
const MAX_NUMBER_ACCEPTED = 1_000_000;

export interface Challenge {
  algorithm: "SHA-256";
  challenge: string;
  maxnumber: number;
  salt: string;
  signature: string;
}

const sha256Hex = (text: string) => createHash("sha256").update(text).digest("hex");
const sign = (secret: string, challenge: string) => createHmac("sha256", secret).update(challenge).digest("hex");

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createChallenge(secret: string, formId: string | number, now = Date.now()): Challenge {
  const expires = Math.floor((now + CHALLENGE_LIFETIME_MS) / 1000);
  const salt = `${randomBytes(12).toString("hex")}?form=${formId}&expires=${expires}`;
  const number = randomInt(0, CHALLENGE_MAX_NUMBER + 1);
  const challenge = sha256Hex(salt + number);
  return { algorithm: "SHA-256", challenge, maxnumber: CHALLENGE_MAX_NUMBER, salt, signature: sign(secret, challenge) };
}

// Puzzles already used, until they would have expired anyway. One process, which suits the
// single-server setup; a second copy of the CMS would need to share this.
const used = new Map<string, number>();

function remember(challenge: string, expiresAtMs: number, now: number) {
  for (const [key, until] of used) if (until <= now) used.delete(key);
  used.set(challenge, expiresAtMs);
}

export type AltchaResult = "ok" | "invalid" | "expired" | "used";

/** Checks the base64 JSON the visitor's browser sends back. */
export function verifySolution(secret: string, formId: string | number, payload: unknown, now = Date.now()): AltchaResult {
  if (typeof payload !== "string" || payload.length > 2000) return "invalid";
  let data: Partial<Record<"algorithm" | "challenge" | "number" | "salt" | "signature", unknown>>;
  try {
    data = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
  } catch {
    return "invalid";
  }
  const { algorithm, challenge, number, salt, signature } = data;
  if (algorithm !== "SHA-256" || typeof challenge !== "string" || typeof salt !== "string" || typeof signature !== "string") return "invalid";
  if (typeof number !== "number" || !Number.isInteger(number) || number < 0 || number > MAX_NUMBER_ACCEPTED) return "invalid";

  const params = new URLSearchParams(salt.split("?")[1] ?? "");
  if (params.get("form") !== String(formId)) return "invalid";
  const expires = Number(params.get("expires")) * 1000;
  if (!Number.isFinite(expires)) return "invalid";

  // Real puzzle (our signature on it) and a correct answer to it.
  if (!safeEqual(sign(secret, challenge), signature)) return "invalid";
  if (!safeEqual(sha256Hex(salt + number), challenge)) return "invalid";

  if (expires < now) return "expired";
  if (used.has(challenge)) return "used";
  remember(challenge, expires, now);
  return "ok";
}
