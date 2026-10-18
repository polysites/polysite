import { describe, expect, it } from "vitest";

import { dedupeKeyFor, emailFieldName, isDuplicateError, normalizeEmail, publicCount, TtlCache } from "./petition";
import type { FormField } from "./validateSubmission";

const fields: FormField[] = [
  { blockType: "text", name: "first_name" },
  { blockType: "email", name: "email_address" },
];
const rows = (email: string) => [
  { field: "first_name", value: "Alex" },
  { field: "email_address", value: email },
];

describe("dedupe key", () => {
  it("is the same for the same person typing the address differently", () => {
    const a = dedupeKeyFor("s", 7, fields, rows("Alex@Example.org"), "email");
    const b = dedupeKeyFor("s", 7, fields, rows("  alex@example.ORG "), "email");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for another address, another form or another secret", () => {
    const base = dedupeKeyFor("s", 7, fields, rows("a@example.org"), "email");
    expect(dedupeKeyFor("s", 7, fields, rows("b@example.org"), "email")).not.toBe(base);
    expect(dedupeKeyFor("s", 8, fields, rows("a@example.org"), "email")).not.toBe(base);
    expect(dedupeKeyFor("other", 7, fields, rows("a@example.org"), "email")).not.toBe(base);
  });

  it("does not contain the address", () => {
    expect(dedupeKeyFor("s", 7, fields, rows("alex@example.org"), "email")).not.toContain("alex");
  });

  it("is null when the form does not de-duplicate, has no email field, or the address is empty", () => {
    expect(dedupeKeyFor("s", 7, fields, rows("a@example.org"), "none")).toBeNull();
    expect(dedupeKeyFor("s", 7, fields, rows("a@example.org"), undefined)).toBeNull();
    expect(dedupeKeyFor("s", 7, [{ blockType: "text", name: "n" }], [{ field: "n", value: "x" }], "email")).toBeNull();
    expect(dedupeKeyFor("s", 7, fields, [{ field: "first_name", value: "Alex" }], "email")).toBeNull();
  });
});

describe("email helpers", () => {
  it("normalises case and spaces", () => expect(normalizeEmail("  Mixed@Case.COM ")).toBe("mixed@case.com"));
  it("finds the first email field", () => expect(emailFieldName(fields)).toBe("email_address"));
  it("returns undefined without one", () => expect(emailFieldName([{ blockType: "text", name: "x" }])).toBeUndefined());
});

describe("duplicate detection", () => {
  it("recognises Postgres' unique violation, also when wrapped", () => {
    expect(isDuplicateError({ code: "23505" })).toBe(true);
    expect(isDuplicateError({ message: "failed", cause: { code: "23505" } })).toBe(true);
    expect(isDuplicateError(new Error('duplicate key value violates unique constraint "x"'))).toBe(true);
  });
  it("recognises Payload's own wrapping of it (a ValidationError naming the dedupe column)", () => {
    expect(isDuplicateError({ name: "ValidationError", message: "The following field is invalid: form_id, dedupe_key" })).toBe(true);
    expect(isDuplicateError({ name: "ValidationError", message: "invalid", data: { errors: [{ path: "dedupeKey" }] } })).toBe(true);
  });
  it("recognises it when the class name is minified, as in a production build", () => {
    expect(isDuplicateError({ name: "d", type: "d", message: "The following field is invalid: form_id, dedupe_key" })).toBe(true);
  });
  it("does not treat an unrelated validation error as a duplicate", () => {
    expect(isDuplicateError({ name: "ValidationError", message: "The following field is invalid: email" })).toBe(false);
  });
  it("does not mistake other failures for one", () => {
    expect(isDuplicateError(new Error("connection refused"))).toBe(false);
    expect(isDuplicateError(null)).toBe(false);
    expect(isDuplicateError({ code: "23502" })).toBe(false);
  });
});

describe("TtlCache", () => {
  it("returns a value until it expires", () => {
    let now = 1000;
    const cache = new TtlCache<number>(10_000, () => now);
    cache.set("a", 5);
    expect(cache.get("a")).toBe(5);
    now += 9_999;
    expect(cache.get("a")).toBe(5);
    now += 2;
    expect(cache.get("a")).toBeUndefined();
  });
  it("stays bounded", () => {
    const cache = new TtlCache<number>(10_000, () => 0, 3);
    for (let i = 0; i < 10; i++) cache.set(String(i), i);
    expect(cache.get("9")).toBe(9);
  });
});

describe("publicCount", () => {
  it("adds the starting number and passes the goal through", () => {
    expect(publicCount(120, 5000, 10000)).toEqual({ count: 5120, goal: 10000 });
  });
  it("ignores nonsense offsets and goals", () => {
    expect(publicCount(3, -4, 0)).toEqual({ count: 3, goal: null });
    expect(publicCount(3, "x", null)).toEqual({ count: 3, goal: null });
    expect(publicCount(-2, undefined, undefined)).toEqual({ count: 0, goal: null });
  });
});
