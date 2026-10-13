import type { Field, Payload } from "payload";
import { beforeEach, describe, expect, it } from "vitest";

import { isBlank, localizeFields, relaxRequired } from "./localize";
import { isDefaultLanguageHere, rememberPayload } from "./registry";

// A Payload whose sites carry the `extensions.languages` contract: each site's languages, default first.
const payloadOffering = (byLanguage: Record<string, string[]>) =>
  ({
    findByID: async ({ id }: { id: unknown }) => {
      const languages = byLanguage[String(id)];
      return languages ? { id, extensions: { languages: { languages, defaultLanguage: languages[0] } } } : { id };
    },
  }) as unknown as Payload;

describe("what counts as nothing written", () => {
  it("is empty, missing and rich text with no words", () => {
    for (const value of [undefined, null, ""]) expect(isBlank(value)).toBe(true);
    expect(isBlank({ root: { type: "root", children: [{ type: "paragraph", children: [] }] } })).toBe(true);
    expect(isBlank({ root: { type: "root", children: [{ type: "paragraph", children: [{ type: "text", text: "" }] }] } })).toBe(true);
  });

  it("is not empty for words, or for rich text that holds only a picture or a link", () => {
    expect(isBlank("Hello")).toBe(false);
    expect(isBlank({ root: { children: [{ type: "paragraph", children: [{ type: "text", text: "Hi" }] }] } })).toBe(false);
    expect(isBlank({ root: { children: [{ type: "upload", value: 3 }] } })).toBe(false);
  });
});

describe("which language is the default for a document", () => {
  beforeEach(() => rememberPayload(payloadOffering({ "1": ["en", "fr"], "2": ["fr", "en"] })));

  it("asks the document's site", async () => {
    expect(await isDefaultLanguageHere({ req: { locale: "en" }, data: { site: 1 } })).toBe(true);
    expect(await isDefaultLanguageHere({ req: { locale: "fr" }, data: { site: 1 } })).toBe(false);
    expect(await isDefaultLanguageHere({ req: { locale: "fr" }, data: { site: 2 } })).toBe(true);
    expect(await isDefaultLanguageHere({ req: { locale: "en" }, data: { site: { id: 2 } } })).toBe(false);
  });

  it("treats a site document as its own site", async () => {
    expect(await isDefaultLanguageHere({ req: { locale: "fr" }, collectionSlug: "sites", id: 2, data: {} })).toBe(true);
    expect(await isDefaultLanguageHere({ req: { locale: "en" }, collectionSlug: "sites", id: 2, data: {} })).toBe(false);
    expect(await isDefaultLanguageHere({ req: { locale: "en" }, collectionSlug: "sites", id: 1, data: {} })).toBe(true);
    // A site being created has no languages yet.
    expect(await isDefaultLanguageHere({ req: { locale: "en" }, collectionSlug: "sites", data: {} })).toBe(true);
  });

  it("treats a request with no language, or no site, as English", async () => {
    expect(await isDefaultLanguageHere({ data: {} })).toBe(true);
    expect(await isDefaultLanguageHere({ req: { locale: "de" }, data: {} })).toBe(false);
  });
});

describe("a required translatable field", () => {
  beforeEach(() => rememberPayload(payloadOffering({ "1": ["en", "fr"] })));

  const required = { name: "heading", type: "text", required: true } as Field;
  const run = async (field: Field, value: unknown, locale: string) =>
    (field as unknown as { validate: (v: unknown, o: unknown) => Promise<unknown> }).validate(value, { req: { locale, t: (k: string) => `T:${k}` }, data: { site: 1 } });

  it("is still required in the site's default language, with Payload's own message", async () => {
    const relaxed = relaxRequired(required);
    expect("required" in relaxed && relaxed.required).toBeFalsy();
    expect(await run(relaxed, "", "en")).toBe("T:validation:required");
    expect(await run(relaxed, "Welcome", "en")).toBe(true);
  });

  it("can be left empty while translating into another language", async () => {
    expect(await run(relaxRequired(required), "", "fr")).toBe(true);
    expect(await run(relaxRequired(required), undefined, "fr")).toBe(true);
  });

  it("still runs the field's own validation", async () => {
    const strict = relaxRequired({ ...required, validate: (v: unknown) => (v === "no" ? "Not that word." : true) } as Field);
    expect(await run(strict, "no", "fr")).toBe("Not that word.");
    expect(await run(strict, "yes", "fr")).toBe(true);
  });

  it("is left alone when the field was never required", () => {
    const optional = { name: "subheading", type: "text" } as Field;
    expect(relaxRequired(optional)).toBe(optional);
  });

  it("is what localizeFields produces for a required text field, inside a block too", async () => {
    const out = localizeFields([{ name: "content", type: "blocks", blocks: [{ slug: "x", fields: [required] }] }] as Field[]);
    const inner = (out[0] as unknown as { blocks: Array<{ fields: Field[] }> }).blocks[0]!.fields[0]!;
    expect((inner as { localized?: boolean }).localized).toBe(true);
    expect(await run(inner, "", "fr")).toBe(true);
    expect(await run(inner, "", "en")).toBe("T:validation:required");
  });
});
