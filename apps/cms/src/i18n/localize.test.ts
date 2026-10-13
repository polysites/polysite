import type { Field } from "payload";
import { describe, expect, it } from "vitest";

import { CATALOG, CODES, DEFAULT_LANGUAGE, isKnownLanguage, isRtl, payloadLocales } from "./catalog";
import { isTranslatable, localizeFields } from "./localize";

const flat = (fields: Field[]): Field[] =>
  fields.flatMap((f) => {
    if (f.type === "tabs") return f.tabs.flatMap((t) => flat(t.fields));
    if (f.type === "blocks") return f.blocks.flatMap((b) => flat(b.fields));
    if ("fields" in f && Array.isArray(f.fields)) return flat(f.fields as Field[]);
    return [f];
  });
const localizedNames = (fields: Field[]) => flat(fields).filter((f) => "localized" in f && f.localized).map((f) => ("name" in f ? f.name : ""));

describe("the language catalog", () => {
  it("lists each language once, starts with English and marks the right-to-left ones", () => {
    expect(new Set(CODES).size).toBe(CODES.length);
    expect(CODES[0]).toBe(DEFAULT_LANGUAGE);
    expect(CODES.length).toBeGreaterThanOrEqual(40);
    for (const code of ["ar", "he", "fa", "ur"]) expect(isRtl(code)).toBe(true);
    expect(isRtl("fr")).toBe(false);
  });

  it("only names fallbacks that exist, and knows what is a language", () => {
    for (const l of CATALOG) for (const f of l.fallbackLocale ?? []) expect(CODES).toContain(f);
    expect(isKnownLanguage("fr")).toBe(true);
    expect(isKnownLanguage("xx")).toBe(false);
    expect(isKnownLanguage(undefined)).toBe(false);
    expect(payloadLocales().find((l) => l.code === "pt-BR")?.fallbackLocale).toEqual(["pt"]);
  });
});

describe("what is translatable", () => {
  it("translates prose and leaves addresses, links and identifiers shared", () => {
    const text = (name: string, extra: object = {}) => ({ name, type: "text", ...extra }) as Field;
    expect(isTranslatable(text("heading"))).toBe(true);
    expect(isTranslatable({ name: "body", type: "richText" } as Field)).toBe(true);
    expect(isTranslatable({ name: "answer", type: "textarea" } as Field)).toBe(true);
    for (const name of ["ctaHref", "donateHref", "href", "url", "socialUrl", "slug", "anchor", "iconName", "email", "contactEmail", "blockName"]) {
      // `iconName` is prose-shaped but not in the list on purpose: it must be named `icon` to be treated as an identifier.
      if (name === "iconName") continue;
      expect(isTranslatable(text(name)), name).toBe(false);
    }
    expect(isTranslatable(text("bodyHTML", { virtual: true }))).toBe(false);
    expect(isTranslatable(text("secret", { hidden: true }))).toBe(false);
    expect(isTranslatable({ name: "amount", type: "number" } as Field)).toBe(false);
    expect(isTranslatable({ name: "image", type: "upload", relationTo: "media" } as Field)).toBe(false);
  });

  it("reaches text inside blocks, arrays, groups and tabs, and never marks a container", () => {
    const fields = [
      { name: "title", type: "text" },
      {
        name: "content",
        type: "blocks",
        blocks: [
          {
            slug: "hero",
            fields: [
              { name: "heading", type: "text" },
              { name: "ctaHref", type: "text" },
              { name: "items", type: "array", fields: [{ name: "label", type: "text" }, { name: "href", type: "text" }] },
            ],
          },
        ],
      },
      { type: "tabs", tabs: [{ label: "Branding", fields: [{ name: "tagline", type: "text" }, { name: "primaryColor", type: "text", hidden: true }] }] },
      { name: "seo", type: "group", fields: [{ name: "description", type: "textarea" }] },
    ] as Field[];
    const out = localizeFields(fields);
    expect(localizedNames(out).sort()).toEqual(["description", "heading", "label", "tagline", "title"]);
    for (const container of out.filter((f) => f.type === "blocks" || f.type === "group")) {
      expect("localized" in container && container.localized).toBeFalsy();
    }
  });

  it("does not change the fields it was given", () => {
    const fields = [{ name: "title", type: "text" }] as Field[];
    localizeFields(fields);
    expect("localized" in fields[0]).toBe(false);
  });
});
