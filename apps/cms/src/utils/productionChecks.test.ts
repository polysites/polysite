import { describe, expect, it } from "vitest";

import { assertProductionSafe, authCookies, productionProblems, weakSecretReason } from "./productionChecks";

const strong = "q8W2x7Zk1Vn4Jb9Tr3Yc6Ho0Pe5Ld8Mf2Gu1Ai4Sx7B";
const publicEnv = { CMS_SCHEME: "https", CMS_DOMAIN: "admin.example.org", PAYLOAD_SECRET: strong };

describe("authCookies", () => {
  it("marks the session cookie Secure exactly when the admin is served over https", () => {
    expect(authCookies({ CMS_SCHEME: "https" }).secure).toBe(true);
    expect(authCookies({ CMS_SCHEME: "http" }).secure).toBe(false);
    expect(authCookies({}).secure).toBe(false);
    expect(authCookies({ CMS_SCHEME: "https" }).sameSite).toBe("Lax");
  });
});

describe("weakSecretReason", () => {
  it("rejects the placeholder from .env.example, short values and nothing", () => {
    expect(weakSecretReason("S", "changeme-generate-a-long-random-string")).toMatch(/placeholder/);
    expect(weakSecretReason("S", "tooshort")).toMatch(/shorter/);
    expect(weakSecretReason("S", undefined)).toMatch(/not set/);
  });
  it("accepts a long random value", () => {
    expect(weakSecretReason("S", strong)).toBeNull();
  });
});

describe("productionProblems", () => {
  it("checks nothing on plain http", () => {
    expect(productionProblems({ CMS_SCHEME: "http", PAYLOAD_SECRET: "changeme" })).toEqual([]);
    expect(productionProblems({})).toEqual([]);
  });
  it("accepts a safe https setup", () => {
    expect(productionProblems(publicEnv)).toEqual([]);
  });
  it("reports every weak secret and a missing CMS_DOMAIN on https", () => {
    const problems = productionProblems({ SITE_SCHEME: "https", PAYLOAD_SECRET: "changeme-x", REVALIDATE_SECRET: "changeme-generate-a-long-random-string", POSTGRES_PASSWORD: "changeme" });
    expect(problems).toHaveLength(4);
  });
  it("leaves out optional secrets that are not set", () => {
    expect(productionProblems(publicEnv)).toEqual([]);
  });
});

describe("assertProductionSafe", () => {
  it("throws on https with a placeholder secret, and not with the escape hatch", () => {
    expect(() => assertProductionSafe({ ...publicEnv, PAYLOAD_SECRET: "changeme-generate-a-long-random-string" })).toThrow(/Refusing to start/);
    expect(() => assertProductionSafe({ ...publicEnv, PAYLOAD_SECRET: "changeme", POLYSITE_ALLOW_WEAK_SECRETS: "1" })).not.toThrow();
  });
});
