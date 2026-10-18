import type { Payload } from "payload";
import { beforeEach, describe, expect, it } from "vitest";

import { languagesFor, offeredBy, previewLanguagesOf, rememberPayload, skipsLanguage, translatedLanguages } from "./registry";

// A Payload whose `sites` collection answers with the documents given, each carrying (or not) the `extensions.languages` contract.
const payloadWith = (sites: Record<string, unknown>, calls: string[] = []) =>
  ({
    findByID: async ({ id }: { id: unknown }) => {
      calls.push(String(id));
      if (!(String(id) in sites)) throw new Error("not found");
      return sites[String(id)];
    },
  }) as unknown as Payload;

const withLanguages = (languages: unknown, defaultLanguage?: unknown) => ({ extensions: { languages: { languages, defaultLanguage } } });

describe("what a language setting means", () => {
  it("offers English alone when nothing usable is set", () => {
    for (const setting of [null, undefined, {}, { languages: [] }, { languages: "fr" }, { languages: [3, ""] }]) expect(offeredBy(setting)).toEqual(["en"]);
  });

  it("puts the default first, and lets the first listed stand in when the default is not offered", () => {
    expect(offeredBy({ languages: ["fr", "en"], defaultLanguage: "en" })).toEqual(["en", "fr"]);
    expect(offeredBy({ languages: ["fr", "de"], defaultLanguage: "xx" })).toEqual(["fr", "de"]);
    expect(offeredBy({ languages: ["fr", "en", "de"] })).toEqual(["fr", "en", "de"]);
  });
});

describe("which languages a site offers", () => {
  beforeEach(() => rememberPayload(payloadWith({ 1: { id: 1 }, 7: withLanguages(["en", "fr"], "en"), 8: { id: 8, extensions: {} } })));

  it("is English alone when no plugin supplies a setting", async () => {
    expect(await languagesFor(1)).toEqual(["en"]);
    expect(await languagesFor(8)).toEqual(["en"]);
    expect(await skipsLanguage({ site: 1 }, "en")).toBe(false);
    expect(await skipsLanguage({ site: 1 }, "fr")).toBe(true);
  });

  it("follows the site's `extensions.languages`, for a site given as an id or as a loaded object", async () => {
    expect(await skipsLanguage({ site: 7 }, "fr")).toBe(false);
    expect(await skipsLanguage({ site: { id: 7 } }, "fr")).toBe(false);
    expect(await skipsLanguage({ site: 7 }, "de")).toBe(true);
  });

  it("is English alone when the site cannot be read", async () => {
    expect(await languagesFor(99)).toEqual(["en"]);
    expect(await languagesFor(undefined)).toEqual(["en"]);
  });

  it("reads a site once per request, however many languages are asked about", async () => {
    const calls: string[] = [];
    rememberPayload(payloadWith({ 7: withLanguages(["en", "fr"]) }, calls));
    const req = {};
    for (const code of ["en", "fr", "de", "es"]) await skipsLanguage({ site: 7 }, code, req);
    expect(calls).toEqual(["7"]);
    await skipsLanguage({ site: 7 }, "fr", {});
    expect(calls).toEqual(["7", "7"]);
  });

  it("never skips a save that has no language", async () => {
    expect(await skipsLanguage({ site: 1 }, undefined)).toBe(false);
  });
});

describe("which languages a document has text in", () => {
  it("lists the languages with a non-empty title", () => {
    expect(translatedLanguages({ en: "Hello", fr: "Bonjour", de: "", es: "   ", it: null })).toEqual(["en", "fr"]);
  });

  it("is empty for anything that is not a per-language title", () => {
    for (const value of [undefined, null, "Hello", 3, []]) expect(translatedLanguages(value)).toEqual([]);
  });
});

describe("languages set to preview only", () => {
  it("lists the offered languages other than the default that the site has hidden from visitors", () => {
    const setting = { languages: ["en", "fr", "ar"], defaultLanguage: "en", previewLanguages: ["ar", "en", "de", 3] };
    expect(previewLanguagesOf(setting)).toEqual(["ar"]);
    expect(previewLanguagesOf({ languages: ["en", "fr"] })).toEqual([]);
    expect(previewLanguagesOf(undefined)).toEqual([]);
    // the offer itself is unchanged: editors can still write every language
    expect(offeredBy(setting)).toEqual(["en", "fr", "ar"]);
  });
});
