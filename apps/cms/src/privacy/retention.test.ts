import { describe, expect, it } from "vitest";

import { computeExpiry } from "./retention";
import { buildExport } from "./export";
import { normalizeEmail, subjectHash } from "./subject";

describe("computeExpiry", () => {
  const from = new Date("2026-01-01T00:00:00.000Z");

  it("adds whole days", () => {
    expect(computeExpiry(from, 30)).toBe("2026-01-31T00:00:00.000Z");
    expect(computeExpiry(from, 1.9)).toBe("2026-01-02T00:00:00.000Z");
  });

  it("keeps forever when there is no valid period", () => {
    for (const v of [undefined, null, 0, -5, Number.NaN]) expect(computeExpiry(from, v as never)).toBeUndefined();
  });
});

describe("subjectHash", () => {
  it("is the same for the same address however it is written", () => {
    expect(subjectHash("k", " Person@Example.ORG ")).toBe(subjectHash("k", "person@example.org"));
  });

  it("differs by address and by secret", () => {
    expect(subjectHash("k", "a@example.org")).not.toBe(subjectHash("k", "b@example.org"));
    expect(subjectHash("k1", "a@example.org")).not.toBe(subjectHash("k2", "a@example.org"));
  });

  it("never contains the address", () => {
    expect(subjectHash("k", "a@example.org")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("normalizeEmail", () => {
  it("trims and lower-cases", () => {
    expect(normalizeEmail("  A@B.Co ")).toBe("a@b.co");
  });
});

describe("buildExport", () => {
  it("lists answers by field with the consent that was recorded", () => {
    const out = buildExport(
      "a@example.org",
      [
        {
          id: 1,
          createdAt: "2026-02-02T10:00:00.000Z",
          form: { title: "Join" },
          submissionData: [
            { field: "email", value: "a@example.org" },
            { field: "postal", value: "K1A 0B1" },
          ],
          consent: { given: true, statement: "We use this to contact you.", at: "2026-02-02T10:00:00.000Z" },
        },
        { id: 2, form: 7, submissionData: [{ field: "email", value: "a@example.org" }], consent: null },
      ],
      new Date("2026-03-01T00:00:00.000Z"),
    );
    expect(out.generatedAt).toBe("2026-03-01T00:00:00.000Z");
    expect(out.records[0]).toMatchObject({ form: "Join", answers: { email: "a@example.org", postal: "K1A 0B1" }, consent: { explicit: true, statement: "We use this to contact you." } });
    expect(out.records[1]).toMatchObject({ form: null, consent: { explicit: false, statement: null } });
  });
});
