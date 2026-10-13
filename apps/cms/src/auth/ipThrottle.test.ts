import { beforeEach, describe, expect, it } from "vitest";

import { clientAddress, noteAttempt, resetThrottle, throttleAuthOperations } from "./ipThrottle";

beforeEach(() => resetThrottle());

describe("noteAttempt", () => {
  it("allows up to the limit, then says how long to wait", () => {
    const env = { POLYSITE_LOGIN_RATE_LIMIT: "3" };
    for (let i = 0; i < 3; i++) expect(noteAttempt("login", "1.2.3.4", 1000 + i, env)).toBe(0);
    expect(noteAttempt("login", "1.2.3.4", 1010, env)).toBeGreaterThan(0);
  });

  it("is per address and per kind", () => {
    const env = { POLYSITE_LOGIN_RATE_LIMIT: "1" };
    expect(noteAttempt("login", "a", 1, env)).toBe(0);
    expect(noteAttempt("login", "b", 1, env)).toBe(0);
    expect(noteAttempt("forgot", "a", 1, env)).toBe(0);
    expect(noteAttempt("login", "a", 2, env)).toBeGreaterThan(0);
  });

  it("forgets attempts older than the window", () => {
    const env = { POLYSITE_LOGIN_RATE_LIMIT: "1" };
    expect(noteAttempt("login", "a", 0, env)).toBe(0);
    expect(noteAttempt("login", "a", 5 * 60_000, env)).toBeGreaterThan(0);
    expect(noteAttempt("login", "a", 11 * 60_000, env)).toBe(0);
  });
});

describe("clientAddress", () => {
  it("takes the last forwarded address, the one the proxy added", () => {
    expect(clientAddress(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("10.0.0.1");
    expect(clientAddress(new Headers({ "x-real-ip": "7.7.7.7" }))).toBe("7.7.7.7");
    expect(clientAddress(undefined)).toBe("");
  });
});

describe("throttleAuthOperations", () => {
  it("ignores other operations and refuses a flood of sign-ins and reset requests with 429", () => {
    const req = { headers: new Headers({ "x-forwarded-for": "5.5.5.5" }) };
    for (let i = 0; i < 50; i++) throttleAuthOperations({ operation: "read", req });
    for (let i = 0; i < 20; i++) throttleAuthOperations({ operation: "login", req });
    expect(() => throttleAuthOperations({ operation: "login", req })).toThrow(/Too many sign-in/);
    for (let i = 0; i < 5; i++) throttleAuthOperations({ operation: "forgotPassword", req });
    expect(() => throttleAuthOperations({ operation: "forgotPassword", req })).toThrow(/Too many password-reset/);
  });
});

describe("calls that did not come through the proxy", () => {
  it("are never limited", () => {
    for (let i = 0; i < 100; i++) throttleAuthOperations({ operation: "login", req: { headers: new Headers() } });
  });
});
