import { describe, expect, it } from "vitest";

import { normalizeDomain, validateSetup } from "./validate";

const THEMES = ["starter", "acme"];
const good = {
  email: "Admin@Example.org ",
  password: "a-long-enough-password",
  confirmPassword: "a-long-enough-password",
  siteName: " Example News ",
  domain: "https://News.Example.org:8080/path",
  theme: "starter",
};

describe("normalizeDomain", () => {
  it("strips scheme, port, path and case", () => {
    expect(normalizeDomain("https://News.Example.org:8080/a/b?x=1")).toBe("news.example.org");
  });

  it("leaves a bare hostname alone", () => {
    expect(normalizeDomain("example.localhost")).toBe("example.localhost");
  });
});

describe("validateSetup", () => {
  it("accepts a complete form and tidies the values", () => {
    const r = validateSetup(good, THEMES);
    expect(r).toEqual({
      ok: true,
      value: {
        email: "admin@example.org",
        password: "a-long-enough-password",
        siteName: "Example News",
        domain: "news.example.org",
        theme: "starter",
        createHomePage: true,
        setupToken: "",
      },
    });
  });

  it("creates a home page unless told not to", () => {
    const r = validateSetup({ ...good, createHomePage: false }, THEMES);
    expect(r.ok && r.value.createHomePage).toBe(false);
  });

  it("rejects a short password", () => {
    const r = validateSetup({ ...good, password: "short", confirmPassword: "short" }, THEMES);
    expect(!r.ok && r.errors.password).toMatch(/at least 10/);
  });

  it("rejects mismatched passwords", () => {
    const r = validateSetup({ ...good, confirmPassword: "something-else-entirely" }, THEMES);
    expect(!r.ok && r.errors.confirmPassword).toBeTruthy();
  });

  it("rejects the email address as the password", () => {
    const r = validateSetup({ ...good, email: "someone@example.org", password: "someone@example.org", confirmPassword: "someone@example.org" }, THEMES);
    expect(!r.ok && r.errors.password).toBeTruthy();
  });

  it("rejects a malformed email and domain", () => {
    const r = validateSetup({ ...good, email: "not-an-email", domain: "not a domain" }, THEMES);
    expect(!r.ok && r.errors.email).toBeTruthy();
    expect(!r.ok && r.errors.domain).toBeTruthy();
  });

  it("rejects a theme that isn't installed", () => {
    const r = validateSetup({ ...good, theme: "nope" }, THEMES);
    expect(!r.ok && r.errors.theme).toBeTruthy();
  });

  it("reports every problem at once and tolerates a non-object body", () => {
    const r = validateSetup(null, THEMES);
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["domain", "email", "password", "siteName", "theme"]);
  });
});
