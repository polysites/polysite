import { createChallenge, type Challenge, verifySolution } from "./altcha";

// The optional bot check on a form (the form's Protection setting). The honeypot, the
// signed timing token and the rate limit in ./spam always apply; this is the extra step.
//
//   none      nothing more
//   altcha    built in, no third party (./altcha)
//   turnstile Cloudflare Turnstile, with the site's own keys (Sites -> Forms)

export type CaptchaProvider = "none" | "altcha" | "turnstile";

export interface CaptchaSettings {
  provider: CaptchaProvider;
  turnstileSiteKey: string;
  turnstileSecretKey: string;
}

export function captchaSettings(form: { protection?: { captcha?: string | null }; site?: { formProtection?: { turnstileSiteKey?: string | null; turnstileSecretKey?: string | null } } }): CaptchaSettings {
  const chosen = form.protection?.captcha;
  const provider: CaptchaProvider = chosen === "altcha" || chosen === "turnstile" ? chosen : "none";
  return {
    provider,
    turnstileSiteKey: form.site?.formProtection?.turnstileSiteKey?.trim() ?? "",
    turnstileSecretKey: form.site?.formProtection?.turnstileSecretKey?.trim() ?? "",
  };
}

/** True when the form asks for Turnstile but its site has no keys, so it can't work. */
export const isMisconfigured = (s: CaptchaSettings) => s.provider === "turnstile" && (!s.turnstileSiteKey || !s.turnstileSecretKey);

/** What the browser needs to show the check, or null when the form has none. */
export function publicCaptcha(s: CaptchaSettings, secret: string, formId: string | number): { provider: "altcha"; challenge: Challenge } | { provider: "turnstile"; siteKey: string } | null {
  if (s.provider === "altcha") return { provider: "altcha", challenge: createChallenge(secret, formId) };
  if (s.provider === "turnstile") return { provider: "turnstile", siteKey: s.turnstileSiteKey };
  return null;
}

export type TurnstileResult = "ok" | "failed" | "unavailable";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Asks Cloudflare whether a Turnstile token is genuine. "unavailable" means we couldn't
 * get an answer (network, timeout, a reply we can't read), which is not the visitor's
 * fault and is not treated as a pass. The visitor's address is deliberately not sent.
 */
export async function verifyTurnstile(secretKey: string, token: unknown, fetchImpl: typeof fetch = fetch): Promise<TurnstileResult> {
  if (typeof token !== "string" || !token || token.length > 4096) return "failed";
  try {
    const res = await fetchImpl(SITEVERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: secretKey, response: token }).toString(),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return "unavailable";
    const body = (await res.json()) as { success?: unknown };
    return body.success === true ? "ok" : "failed";
  } catch {
    return "unavailable";
  }
}

export type CaptchaOutcome = { ok: true } | { ok: false; status: number; message: string };

export async function checkCaptcha(s: CaptchaSettings, secret: string, formId: string | number, token: unknown, fetchImpl: typeof fetch = fetch): Promise<CaptchaOutcome> {
  if (s.provider === "none") return { ok: true };

  if (s.provider === "altcha") {
    const result = verifySolution(secret, formId, token);
    if (result === "ok") return { ok: true };
    return { ok: false, status: 400, message: result === "expired" || result === "used" ? "This form has expired. Reload the page and try again." : "We couldn't confirm you're not a robot. Please try again." };
  }

  const result = await verifyTurnstile(s.turnstileSecretKey, token, fetchImpl);
  if (result === "ok") return { ok: true };
  if (result === "unavailable") return { ok: false, status: 503, message: "We couldn't run the check right now. Please try again in a moment." };
  return { ok: false, status: 400, message: "Please complete the check and try again." };
}
