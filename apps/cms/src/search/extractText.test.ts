import { describe, expect, it } from "vitest";

import { extractSearchText, flattenRichText, MAX_SEARCH_TEXT, tidy } from "./extractText";

const text = (t: string, format = 0) => ({ type: "text", text: t, format, version: 1 });
const para = (...children: unknown[]) => ({ type: "paragraph", children, version: 1 });
const lexical = (...blocks: unknown[]) => ({ root: { type: "root", children: blocks, version: 1 } });

describe("flattenRichText", () => {
  it("joins formatted runs of one paragraph without a gap and separates blocks", () => {
    const value = lexical(para(text("Hel"), text("lo", 1), text(" world")), { type: "heading", children: [text("Title")] }, { type: "list", children: [{ type: "listitem", children: [text("one")] }, { type: "listitem", children: [text("two")] }] });
    expect(tidy(flattenRichText(value))).toBe("Hello world Title one two");
  });

  it("keeps link text and drops the address; skips uploads, relationships and rules", () => {
    const value = lexical(para(text("See "), { type: "link", fields: { url: "https://secret.example/x" }, children: [text("the budget")] }), { type: "upload", value: { filename: "a.png" } }, { type: "horizontalrule" });
    const out = tidy(flattenRichText(value));
    expect(out).toBe("See the budget");
  });

  it("reads the prose fields of a block placed in the text, not its identifiers or addresses", () => {
    const value = lexical({ type: "block", fields: { id: "abc123", blockType: "cta", blockName: "n", label: "Join us", ctaHref: "/join", note: { root: { children: [para(text("inner words"))] } } } });
    const out = tidy(flattenRichText(value));
    expect(out).toContain("Join us");
    expect(out).toContain("inner words");
    expect(out).not.toContain("abc123");
    expect(out).not.toContain("/join");
  });

  it("is harmless on nonsense", () => {
    for (const v of [null, undefined, 5, "x", [], {}, { root: null }, { root: { children: "no" } }]) expect(typeof flattenRichText(v)).toBe("string");
  });
});

describe("extractSearchText", () => {
  const faq = { slug: "faq", fields: [{ type: "text", name: "heading" }, { type: "array", name: "items", fields: [{ type: "text", name: "question" }, { type: "textarea", name: "answer" }] }] };
  const hero = { slug: "hero", fields: [{ type: "text", name: "heading" }, { type: "text", name: "ctaHref" }, { type: "upload", name: "image" }] };
  const fields = [
    { type: "text", name: "title" },
    { type: "text", name: "slug" },
    { type: "select", name: "status" },
    { type: "richText", name: "body" },
    { type: "textarea", name: "reviewNote", access: { read: () => true } },
    { type: "text", name: "bodyHTML", virtual: true },
    { type: "text", name: "internal", hidden: true },
    { type: "tabs", tabs: [{ name: "meta", fields: [{ type: "text", name: "title" }, { type: "textarea", name: "description" }] }] },
    { type: "group", name: "extra", fields: [{ type: "text", name: "byline" }] },
    { type: "blocks", name: "content", blocks: [hero, faq] },
  ];
  const doc = {
    title: "Page title",
    slug: "page-slug",
    status: "published",
    body: lexical(para(text("Body words"))),
    reviewNote: "private note",
    bodyHTML: "<p>html</p>",
    internal: "hidden thing",
    meta: { title: "SEO title", description: "SEO description" },
    extra: { byline: "By Alex" },
    content: [
      { blockType: "hero", heading: "Big heading", ctaHref: "/go", image: 7 },
      { blockType: "faq", heading: "Questions", items: [{ question: "Why?", answer: "Because." }] },
      { blockType: "unknownBlock", heading: "ignored" },
    ],
  };

  it("collects prose from rich text, blocks, arrays, groups and tabs", () => {
    const out = extractSearchText(doc, fields);
    for (const word of ["Body words", "SEO description", "By Alex", "Big heading", "Questions", "Why?", "Because."]) expect(out).toContain(word);
  });

  it("leaves out the title, the slug, addresses, hidden, virtual and read-restricted fields, and unknown blocks", () => {
    const out = extractSearchText(doc, fields);
    for (const word of ["Page title", "page-slug", "/go", "private note", "html", "hidden thing", "ignored", "published"]) expect(out).not.toContain(word);
  });

  it("is plain text: no markup characters were invented and whitespace is one space", () => {
    const out = extractSearchText({ body: lexical(para(text("a\n\n  b\t<i>c</i>"))) }, [{ type: "richText", name: "body" }]);
    expect(out).toBe("a b <i>c</i>");
  });

  it("lets a collection opt out or leave fields out", () => {
    expect(extractSearchText(doc, fields, false)).toBe("");
    const out = extractSearchText(doc, fields, { exclude: ["body"] });
    expect(out).not.toContain("Body words");
    expect(out).toContain("By Alex");
  });

  it("caps the text and cuts at a word", () => {
    const long = "word ".repeat(40_000);
    const out = extractSearchText({ body: lexical(para(text(long))) }, [{ type: "richText", name: "body" }]);
    expect(out.length).toBeLessThanOrEqual(MAX_SEARCH_TEXT);
    expect(out.length).toBeGreaterThan(MAX_SEARCH_TEXT - 10);
    expect(out.endsWith("word")).toBe(true);
  });

  it("returns an empty string for nothing usable", () => {
    expect(extractSearchText(null, fields)).toBe("");
    expect(extractSearchText({}, undefined)).toBe("");
    expect(extractSearchText({ body: 3 }, [{ type: "richText", name: "body" }])).toBe("");
  });
});
