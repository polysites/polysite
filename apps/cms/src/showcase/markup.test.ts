import { describe, expect, it } from "vitest";

import { inline, markupToLexical } from "./markup";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const kids = (markup: string) => markupToLexical(markup).root.children as Array<Record<string, any>>;

describe("inline", () => {
  it("splits bold, italic and links out of a line", () => {
    const nodes = inline("a **b** c *d* [e](https://example.org) f");
    expect(nodes.map((n) => n.text ?? n.children)).toHaveLength(7);
    expect(nodes[1]).toMatchObject({ text: "b", format: 1 });
    expect(nodes[3]).toMatchObject({ text: "d", format: 2 });
    expect(nodes[5]).toMatchObject({ type: "link", fields: { url: "https://example.org" } });
  });
  it("keeps plain text as one node and an empty line as one empty node", () => {
    expect(inline("plain")).toHaveLength(1);
    expect(inline("")).toHaveLength(1);
  });
});

describe("markupToLexical", () => {
  it("makes a paragraph per blank-line separated chunk, joining its lines", () => {
    const out = kids("First line\nsecond line.\n\nNext paragraph.");
    expect(out.map((n) => n.type)).toEqual(["paragraph", "paragraph"]);
    expect(out[0]!.children[0].text).toBe("First line second line.");
  });
  it("makes headings of ## and ###", () => {
    const out = kids("## Big\n\n### Small");
    expect(out.map((n) => [n.type, n.tag])).toEqual([["heading", "h2"], ["heading", "h3"]]);
  });
  it("makes bullet, numbered and quote blocks", () => {
    const out = kids("- one\n- two\n\n1. first\n2. second\n\n> said");
    expect(out[0]).toMatchObject({ type: "list", listType: "bullet", tag: "ul" });
    expect(out[0]!.children).toHaveLength(2);
    expect(out[1]).toMatchObject({ type: "list", listType: "number", tag: "ol" });
    expect(out[2]!.type).toBe("quote");
  });
  it("is never empty", () => {
    expect(markupToLexical("").root.children).toHaveLength(1);
  });
  it("wraps in a Lexical root", () => {
    expect(markupToLexical("x").root).toMatchObject({ type: "root", version: 1 });
  });
});
