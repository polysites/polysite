import { describe, expect, it } from "vitest";

import { checkToken, clientAddress, issueToken, MAX_TOKEN_AGE_MS, MIN_FILL_MS, RateLimiter } from "./spam";

const secret = "test-secret";

describe("form tokens", () => {
  it("accepts a token that is a moment old", () => {
    const t = issueToken(secret, 7, 1_000_000);
    expect(checkToken(secret, 7, t, 1_000_000 + MIN_FILL_MS + 1)).toBe("ok");
  });

  it("rejects a submission faster than a person could manage", () => {
    const t = issueToken(secret, 7, 1_000_000);
    expect(checkToken(secret, 7, t, 1_000_000 + 200)).toBe("too-fast");
  });

  it("rejects an old token", () => {
    const t = issueToken(secret, 7, 1_000_000);
    expect(checkToken(secret, 7, t, 1_000_000 + MAX_TOKEN_AGE_MS + 1)).toBe("expired");
  });

  it("rejects a missing, forged or other-form token", () => {
    const now = 5_000_000;
    const t = issueToken(secret, 7, now - 10_000);
    expect(checkToken(secret, 7, undefined, now)).toBe("missing");
    expect(checkToken(secret, 7, "garbage", now)).toBe("invalid");
    expect(checkToken(secret, 7, `${now - 10_000}.AAAA`, now)).toBe("invalid");
    expect(checkToken(secret, 8, t, now)).toBe("invalid");
    expect(checkToken("other-secret", 7, t, now)).toBe("invalid");
  });
});

describe("RateLimiter", () => {
  it("allows up to the limit in a window, then blocks, then recovers", () => {
    let now = 0;
    const rl = new RateLimiter([{ windowMs: 60_000, max: 3 }], () => now);
    expect([rl.allow("a"), rl.allow("a"), rl.allow("a"), rl.allow("a")]).toEqual([true, true, true, false]);
    now = 61_000;
    expect(rl.allow("a")).toBe(true);
  });

  it("tracks each key separately and enforces every window", () => {
    let now = 0;
    const rl = new RateLimiter(
      [
        { windowMs: 1_000, max: 2 },
        { windowMs: 3_600_000, max: 3 },
      ],
      () => now,
    );
    expect(rl.allow("a")).toBe(true);
    expect(rl.allow("b")).toBe(true);
    expect(rl.allow("a")).toBe(true);
    now = 2_000;
    expect(rl.allow("a")).toBe(true); // 3rd in the hour
    now = 4_000;
    expect(rl.allow("a")).toBe(false); // hourly cap reached
  });
});

describe("clientAddress", () => {
  it("prefers the first forwarded address", () => {
    expect(clientAddress(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
  });

  it("falls back to unknown", () => {
    expect(clientAddress(new Headers())).toBe("unknown");
  });
});
