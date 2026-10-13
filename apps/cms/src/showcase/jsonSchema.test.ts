import { describe, expect, it } from "vitest";

import { closest, formatIssues, type Schema, validate } from "./jsonSchema";

const schema: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "kind"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 5 },
    kind: { enum: ["salon", "portfolio"] },
    age: { type: "integer", minimum: 1, maximum: 9 },
    color: { $ref: "#/$defs/color", description: "ignored when the ref has its own description" },
    tags: { type: "array", minItems: 1, items: { type: "string" } },
    either: { oneOf: [{ type: "boolean" }, { type: "object", additionalProperties: false, properties: { a: { type: "string" } } }] },
    blocks: {
      type: "array",
      items: {
        type: "object",
        required: ["blockType"],
        properties: { blockType: { enum: ["a", "b"] } },
        allOf: [
          { if: { required: ["blockType"], properties: { blockType: { const: "a" } } }, then: { type: "object", required: ["x"], properties: { blockType: { const: "a" }, x: { type: "string" } }, additionalProperties: false } },
        ],
      },
    },
    loose: { type: ["object", "null"] },
  },
  $defs: { color: { type: "string", pattern: "^#[0-9a-f]{6}$", description: "a hex colour" } },
};

const paths = (issues: { path: string }[]) => issues.map((i) => i.path);

describe("validate", () => {
  it("accepts a valid document", () => {
    expect(validate(schema, { name: "ok", kind: "salon", age: 3, color: "#aabbcc", tags: ["x"], either: true })).toEqual([]);
  });

  it("names the path of a missing required property", () => {
    const issues = validate(schema, { name: "ok" });
    expect(issues).toEqual([{ path: "kind", message: "is required" }]);
  });

  it("reports the wrong type with what was found", () => {
    const [issue] = validate(schema, { name: 5, kind: "salon" });
    expect(issue).toEqual({ path: "name", message: "must be a string, found integer" });
  });

  it("lists the allowed values of an enum and suggests the closest", () => {
    const [issue] = validate(schema, { name: "ok", kind: "saloon" });
    expect(issue!.path).toBe("kind");
    expect(issue!.message).toContain('one of "salon", "portfolio"');
    expect(issue!.message).toContain('did you mean "salon"');
  });

  it("flags an unknown property and suggests the likely spelling", () => {
    const [issue] = validate(schema, { name: "ok", kind: "salon", tag: ["x"] });
    expect(issue).toEqual({ path: "tag", message: 'is not a known property here (did you mean "tags"?)' });
  });

  it("checks string length, number range and array size", () => {
    const issues = validate(schema, { name: "toolong", kind: "salon", age: 12, tags: [] });
    expect(paths(issues).sort()).toEqual(["age", "name", "tags"]);
    expect(issues.find((i) => i.path === "tags")!.message).toBe("needs at least 1 item");
  });

  it("follows $ref and uses the referenced description for a pattern miss", () => {
    const [issue] = validate(schema, { name: "ok", kind: "salon", color: "red" });
    expect(issue!.path).toBe("color");
    expect(issue!.message).toContain("not in the expected form");
  });

  it("indexes array items in the path", () => {
    const issues = validate(schema, { name: "ok", kind: "salon", tags: ["a", 2] });
    expect(paths(issues)).toEqual(["tags[1]"]);
  });

  it("applies a then-branch only to the block it matches", () => {
    const ok = validate(schema, { name: "ok", kind: "salon", blocks: [{ blockType: "a", x: "1" }, { blockType: "b", whatever: 1 }] });
    expect(ok).toEqual([]);
    const bad = validate(schema, { name: "ok", kind: "salon", blocks: [{ blockType: "a", y: 1 }] });
    expect(paths(bad).sort()).toEqual(["blocks[0].x", "blocks[0].y"]);
    const noType = validate(schema, { name: "ok", kind: "salon", blocks: [{}] });
    expect(paths(noType)).toEqual(["blocks[0].blockType"]);
  });

  it("oneOf accepts exactly one matching choice", () => {
    expect(validate(schema, { name: "ok", kind: "salon", either: { a: "x" } })).toEqual([]);
    const [issue] = validate(schema, { name: "ok", kind: "salon", either: "nope" });
    expect(issue!.message).toBe("must be boolean or object");
  });

  it("accepts any of several types", () => {
    expect(validate(schema, { name: "ok", kind: "salon", loose: null })).toEqual([]);
    expect(validate(schema, { name: "ok", kind: "salon", loose: [] })[0]!.message).toContain("one of object or null");
  });

  it("does not pass a document of the wrong root type", () => {
    expect(validate(schema, [])[0]).toEqual({ path: "", message: "must be an object, found array" });
  });
});

describe("formatIssues", () => {
  it("names the file and the path", () => {
    expect(formatIssues("polysite-theme-x/showcase/site.json", [{ path: "pages[1].slug", message: "is required" }, { path: "", message: "bad" }])).toEqual([
      "polysite-theme-x/showcase/site.json: pages[1].slug: is required",
      "polysite-theme-x/showcase/site.json: bad",
    ]);
  });
});

describe("closest", () => {
  it("suggests only near matches", () => {
    expect(closest("heding", ["heading", "image"])).toBe("heading");
    expect(closest("zzzzzz", ["heading", "image"])).toBeUndefined();
  });
});
