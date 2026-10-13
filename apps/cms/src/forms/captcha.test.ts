import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { CHALLENGE_LIFETIME_MS, createChallenge, verifySolution } from "./altcha";
import { captchaSettings, checkCaptcha, isMisconfigured, publicCaptcha, verifyTurnstile } from "./captcha";
import { decrypt, encrypt, SECRET_MASK } from "./secrets";
import { validateSubmission } from "./validateSubmission";

const SECRET = "test-secret";

/** What the visitor's browser does: find the number that hashes to the challenge. */
function solve(c: ReturnType<typeof createChallenge>, tweak: Record<string, unknown> = {}) {
  for (let n = 0; n <= c.maxnumber; n++) {
    if (createHash("sha256").update(c.salt + n).digest("hex") === c.challenge) {
      return Buffer.from(JSON.stringify({ algorithm: c.algorithm, challenge: c.challenge, number: n, salt: c.salt, signature: c.signature, ...tweak })).toString("base64");
    }
  }
  throw new Error("unsolvable");
}

describe("ALTCHA", () => {
  it("accepts a correct answer once, and refuses a replay", () => {
    const c = createChallenge(SECRET, 7);
    const answer = solve(c);
    expect(verifySolution(SECRET, 7, answer)).toBe("ok");
    expect(verifySolution(SECRET, 7, answer)).toBe("used");
  });

  it("refuses a wrong number, a made-up puzzle and a puzzle signed with another secret", () => {
    const c = createChallenge(SECRET, 7);
    expect(verifySolution(SECRET, 7, solve(c, { number: 1 }))).toBe("invalid");
    const forged = createChallenge("some-other-secret", 7);
    expect(verifySolution(SECRET, 7, solve(forged))).toBe("invalid");
    expect(verifySolution(SECRET, 7, solve(c, { signature: "00" }))).toBe("invalid");
  });

  it("refuses an answer made for a different form", () => {
    const c = createChallenge(SECRET, 7);
    expect(verifySolution(SECRET, 8, solve(c))).toBe("invalid");
  });

  it("refuses an expired puzzle", () => {
    const now = Date.now();
    const c = createChallenge(SECRET, 9, now - CHALLENGE_LIFETIME_MS - 5000);
    expect(verifySolution(SECRET, 9, solve(c), now)).toBe("expired");
  });

  it("refuses junk without throwing", () => {
    for (const bad of [undefined, null, 5, "", "not base64 json", Buffer.from("{}").toString("base64"), "x".repeat(5000)]) {
      expect(verifySolution(SECRET, 7, bad)).toBe("invalid");
    }
  });
});

describe("Turnstile", () => {
  const reply = (body: unknown, ok = true) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

  it("passes only when Cloudflare says success, and sends the secret and token, not the visitor's address", async () => {
    let sent = "";
    const spy = (async (_url: string, init: { body: string }) => {
      sent = init.body;
      return { ok: true, json: async () => ({ success: true }) };
    }) as unknown as typeof fetch;
    expect(await verifyTurnstile("sekret", "tok", spy)).toBe("ok");
    expect(sent).toBe("secret=sekret&response=tok");
    expect(await verifyTurnstile("sekret", "tok", reply({ success: false }))).toBe("failed");
    expect(await verifyTurnstile("sekret", "", reply({ success: true }))).toBe("failed");
    expect(await verifyTurnstile("sekret", undefined, reply({ success: true }))).toBe("failed");
  });

  it("treats no answer from Cloudflare as unavailable, never as a pass", async () => {
    expect(await verifyTurnstile("s", "t", reply({}, false))).toBe("unavailable");
    expect(await verifyTurnstile("s", "t", (async () => { throw new Error("offline"); }) as unknown as typeof fetch)).toBe("unavailable");
    expect(await verifyTurnstile("s", "t", (async () => ({ ok: true, json: async () => { throw new Error("bad json"); } })) as unknown as typeof fetch)).toBe("unavailable");
  });
});

describe("a form's bot check", () => {
  const site = { formProtection: { turnstileSiteKey: "0xSITEKEY1234", turnstileSecretKey: "0xSECRET12345" } };

  it("defaults to none and ignores unknown values", () => {
    expect(captchaSettings({}).provider).toBe("none");
    expect(captchaSettings({ protection: { captcha: "recaptcha" } }).provider).toBe("none");
  });

  it("flags Turnstile without keys, and only that", () => {
    expect(isMisconfigured(captchaSettings({ protection: { captcha: "turnstile" } }))).toBe(true);
    expect(isMisconfigured(captchaSettings({ protection: { captcha: "turnstile" }, site }))).toBe(false);
    expect(isMisconfigured(captchaSettings({ protection: { captcha: "altcha" } }))).toBe(false);
  });

  it("gives the browser a puzzle or the public site key, never the secret", () => {
    const altcha = publicCaptcha(captchaSettings({ protection: { captcha: "altcha" } }), SECRET, 3);
    expect(altcha).toMatchObject({ provider: "altcha", challenge: { algorithm: "SHA-256" } });
    const turnstile = publicCaptcha(captchaSettings({ protection: { captcha: "turnstile" }, site }), SECRET, 3);
    expect(turnstile).toEqual({ provider: "turnstile", siteKey: "0xSITEKEY1234" });
    expect(JSON.stringify(turnstile)).not.toContain("SECRET");
    expect(publicCaptcha(captchaSettings({}), SECRET, 3)).toBeNull();
  });

  it("lets a form with no check through, and stops one that fails", async () => {
    expect(await checkCaptcha(captchaSettings({}), SECRET, 3, undefined)).toEqual({ ok: true });
    const altcha = captchaSettings({ protection: { captcha: "altcha" } });
    expect(await checkCaptcha(altcha, SECRET, 3, undefined)).toMatchObject({ ok: false, status: 400 });
    const c = createChallenge(SECRET, 3);
    expect(await checkCaptcha(altcha, SECRET, 3, solve(c))).toEqual({ ok: true });
    expect(await checkCaptcha(altcha, SECRET, 3, solve(c))).toMatchObject({ ok: false, status: 400 }); // replay
    const turnstile = captchaSettings({ protection: { captcha: "turnstile" }, site });
    const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    expect(await checkCaptcha(turnstile, SECRET, 3, "tok", down)).toMatchObject({ ok: false, status: 503 });
  });
});

describe("hidden fields", () => {
  const fields = [
    { blockType: "email", name: "email", label: "Email", required: true },
    { blockType: "hidden", name: "campaign", source: "param", value: "utm_campaign" },
    { blockType: "hidden", name: "channel", source: "fixed", value: "spring-appeal" },
  ];

  it("stores what the page sent as untrusted text, and is never required", () => {
    expect(validateSubmission(fields, { email: "a@example.org", campaign: "  summer  ", channel: "tampered" })).toEqual({
      ok: true,
      rows: [
        { field: "email", value: "a@example.org" },
        { field: "campaign", value: "summer" },
        { field: "channel", value: "spring-appeal" }, // fixed values come from the form, not the browser
      ],
    });
    const none = validateSubmission(fields, { email: "a@example.org" });
    expect(none).toMatchObject({ ok: true });
    expect(none.ok && none.rows.map((r) => r.field)).toEqual(["email", "channel"]);
  });

  it("cuts an over-long value instead of turning a visitor away", () => {
    const res = validateSubmission(fields, { email: "a@example.org", campaign: "x".repeat(900) });
    expect(res.ok && res.rows.find((r) => r.field === "campaign")?.value).toHaveLength(500);
  });
});

describe("secret keys at rest", () => {
  process.env.PAYLOAD_SECRET = "unit-test-secret";

  it("encrypts, decrypts and doesn't double-encrypt", () => {
    const stored = encrypt("0xABCDEF123456");
    expect(stored.startsWith("enc:v1:")).toBe(true);
    expect(stored).not.toContain("ABCDEF");
    expect(encrypt(stored)).toBe(stored);
    expect(decrypt(stored)).toBe("0xABCDEF123456");
    expect(decrypt("legacy-plain")).toBe("legacy-plain");
    expect(decrypt("")).toBe("");
    expect(encrypt("")).toBe("");
    expect(SECRET_MASK).not.toBe("");
  });
});
