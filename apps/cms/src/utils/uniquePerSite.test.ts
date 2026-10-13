import { describe, expect, it, vi } from "vitest";

import { uniquePerSite } from "./uniquePerSite";

const run = (validate: ReturnType<typeof uniquePerSite>, value: unknown, opts: Record<string, unknown>) =>
  validate(value as never, opts as never);

describe("uniquePerSite", () => {
  const find = vi.fn();
  const req = { payload: { find } };

  it("rejects an empty value when the field is required, instead of letting the database refuse it later", async () => {
    const validate = uniquePerSite("pages", "slug");
    for (const value of [undefined, null, ""]) {
      expect(await run(validate, value, { required: true, data: { site: 1 }, req })).toBe("This field is required.");
    }
    expect(find).not.toHaveBeenCalled();
  });

  it("accepts an empty value when the field is optional", async () => {
    const validate = uniquePerSite("pages", "slug");
    expect(await run(validate, "", { required: false, data: { site: 1 }, req })).toBe(true);
  });

  it("skips the uniqueness lookup until a site is chosen", async () => {
    const validate = uniquePerSite("pages", "slug");
    expect(await run(validate, "about", { required: true, data: {}, req })).toBe(true);
    expect(find).not.toHaveBeenCalled();
  });

  it("reports a value another document on the same site already uses", async () => {
    find.mockResolvedValueOnce({ totalDocs: 1 });
    const validate = uniquePerSite("pages", "slug");
    expect(await run(validate, "about", { required: true, data: { site: 1 }, id: 5, req })).toContain("already uses");
  });

  it("accepts a free value", async () => {
    find.mockResolvedValueOnce({ totalDocs: 0 });
    const validate = uniquePerSite("pages", "slug");
    expect(await run(validate, "about", { required: true, data: { site: { id: 2 } }, req })).toBe(true);
  });
});
