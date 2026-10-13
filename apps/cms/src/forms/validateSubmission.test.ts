import { describe, expect, it } from "vitest";

import { type FormField, validateSubmission } from "./validateSubmission";

const fields: FormField[] = [
  { blockType: "email", name: "email", label: "Email", required: true },
  { blockType: "text", name: "postal", label: "Postal code", required: true },
  { blockType: "textarea", name: "note", label: "Note" },
  { blockType: "number", name: "age", label: "Age" },
  { blockType: "select", name: "party", label: "Party", options: [{ label: "A", value: "a" }, { label: "B", value: "b" }] },
  { blockType: "checkbox", name: "consent", label: "I agree", required: true },
  { blockType: "message", label: "intro text" },
];

const good = { email: "a@example.org", postal: "K1A 0B1", consent: true };

describe("validateSubmission", () => {
  it("accepts a complete submission and returns rows in form order", () => {
    const r = validateSubmission(fields, { ...good, note: "hello", age: "42", party: "b" });
    expect(r).toEqual({
      ok: true,
      rows: [
        { field: "email", value: "a@example.org" },
        { field: "postal", value: "K1A 0B1" },
        { field: "note", value: "hello" },
        { field: "age", value: "42" },
        { field: "party", value: "b" },
        { field: "consent", value: "true" },
      ],
    });
  });

  it("ignores fields the form doesn't define", () => {
    const r = validateSubmission(fields, { ...good, admin: "true", __proto__: "x" });
    expect(r.ok && r.rows.map((x) => x.field)).toEqual(["email", "postal", "consent"]);
  });

  it("reports every missing required field at once", () => {
    const r = validateSubmission(fields, {});
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["consent", "email", "postal"]);
  });

  it("rejects a bad email, number and option", () => {
    const r = validateSubmission(fields, { ...good, email: "nope", age: "abc", party: "z" });
    expect(!r.ok && r.errors.email).toBeTruthy();
    expect(!r.ok && r.errors.age).toBeTruthy();
    expect(!r.ok && r.errors.party).toBeTruthy();
  });

  it("limits value length, with a larger allowance for textareas", () => {
    expect(validateSubmission(fields, { ...good, postal: "x".repeat(501) }).ok).toBe(false);
    expect(validateSubmission(fields, { ...good, note: "x".repeat(5000) }).ok).toBe(true);
    expect(validateSubmission(fields, { ...good, note: "x".repeat(5001) }).ok).toBe(false);
  });

  it("trims whitespace and treats an optional blank as absent", () => {
    const r = validateSubmission(fields, { ...good, email: "  a@example.org ", note: "   " });
    expect(r.ok && r.rows.find((x) => x.field === "email")?.value).toBe("a@example.org");
    expect(r.ok && r.rows.some((x) => x.field === "note")).toBe(false);
  });

  it("treats an unchecked required checkbox as missing and an optional one as false", () => {
    expect(validateSubmission(fields, { ...good, consent: false }).ok).toBe(false);
    const optional = validateSubmission([{ blockType: "checkbox", name: "news", label: "News" }], {});
    expect(optional).toEqual({ ok: true, rows: [{ field: "news", value: "false" }] });
  });

  it("copes with a non-object body", () => {
    expect(validateSubmission(fields, null).ok).toBe(false);
    expect(validateSubmission(fields, ["a"]).ok).toBe(false);
  });
});

describe("email normalization", () => {
  it("stores email values in lower case", () => {
    const r = validateSubmission(fields, { email: "Mixed@Example.ORG", postal: "K1A", consent: true });
    expect(r.ok && r.rows.find((x) => x.field === "email")?.value).toBe("mixed@example.org");
  });
});
