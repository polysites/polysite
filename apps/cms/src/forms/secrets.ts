import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

// A site's captcha secret key is a credential, so it is encrypted at rest with
// AES-256-GCM, keyed from PAYLOAD_SECRET through HKDF with a label of its own (a key
// derived for another purpose can't decrypt it). Same stored form as the email and
// notifications plugins' secrets: "enc:v1:" + base64(iv | tag | ciphertext). Changing
// PAYLOAD_SECRET makes a stored value undecryptable; decrypt() then returns "" and logs,
// and entering the key again fixes it.
const ENC_PREFIX = "enc:v1:";
export const SECRET_MASK = "••••••••";
let cachedKey: Buffer | undefined;

function secretKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.PAYLOAD_SECRET;
  if (!secret) throw new Error("PAYLOAD_SECRET is not set -- cannot encrypt a captcha secret key");
  cachedKey = Buffer.from(hkdfSync("sha256", secret, "polysite-core-forms", "captcha-secret-v1", 32));
  return cachedKey;
}

export function encrypt(plain: string | null | undefined): string {
  if (!plain || plain.startsWith(ENC_PREFIX)) return plain ?? "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ENC_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function decrypt(stored: string | null | undefined): string {
  if (!stored) return "";
  if (!stored.startsWith(ENC_PREFIX)) return stored; // saved before encryption existed: read as is, encrypted on its next save
  try {
    const raw = Buffer.from(stored.slice(ENC_PREFIX.length), "base64");
    const decipher = createDecipheriv("aes-256-gcm", secretKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    console.error("[forms] could not decrypt a site's captcha secret key (was PAYLOAD_SECRET changed?) -- enter it again on the site's Forms tab");
    return "";
  }
}
