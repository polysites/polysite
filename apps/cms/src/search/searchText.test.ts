import { describe, expect, it } from "vitest";

import { backfillSearchText, searchTextFor } from "./searchText";

const lexical = (t: string) => ({ root: { type: "root", children: [{ type: "paragraph", children: [{ type: "text", text: t }] }] } });
const fields = [{ type: "text", name: "title" }, { type: "richText", name: "body" }];

function fakePayload(docs: Record<string, Record<string, unknown>>, rows: { id: number; doc: { relationTo: string; value: number } }[]) {
  const updates: { id: number; text: string; locale: string }[] = [];
  const done = new Set<number>();
  return {
    updates,
    collections: { pages: { config: { fields } }, notes: { config: { fields, custom: { polysite: { searchText: false } } } } },
    async find({ where, locale }: { where: { and: Record<string, { greater_than?: number }>[] }; locale: string }) {
      const after = where.and.find((c) => c.id)?.id?.greater_than ?? 0;
      return { docs: locale === "fr" ? [] : rows.filter((r) => r.id > after && !done.has(r.id)) };
    },
    async findByID({ collection, id }: { collection: string; id: number }) {
      const doc = docs[`${collection}:${id}`];
      if (!doc) throw new Error("gone");
      return doc;
    },
    async update({ id, data, locale }: { id: number; data: { searchText: string }; locale: string }) {
      updates.push({ id, text: data.searchText, locale });
      done.add(id);
    },
  };
}

describe("searchTextFor", () => {
  const payload = fakePayload({}, []) as never;
  it("is the document's words when published, and nothing for a draft, a redirect, an opted-out collection or an unknown one", () => {
    const doc = { title: "T", body: lexical("hello there"), _status: "published" };
    expect(searchTextFor(payload, "pages", doc)).toBe("hello there");
    expect(searchTextFor(payload, "pages", { ...doc, _status: "draft" })).toBe("");
    expect(searchTextFor(payload, "redirects", doc)).toBe("");
    expect(searchTextFor(payload, "notes", doc)).toBe("");
    expect(searchTextFor(payload, "nope", doc)).toBe("");
    expect(searchTextFor(payload, "pages", null)).toBe("");
  });
});

describe("backfillSearchText", () => {
  it("gives every row without text a string, once, and never reads a draft's words", async () => {
    const payload = fakePayload(
      {
        "pages:1": { body: lexical("alpha beta"), _status: "published" },
        "pages:2": { body: lexical("secret draft"), _status: "draft" },
      },
      [
        { id: 1, doc: { relationTo: "pages", value: 1 } },
        { id: 2, doc: { relationTo: "pages", value: 2 } },
        { id: 3, doc: { relationTo: "pages", value: 99 } },
        { id: 4, doc: { relationTo: "redirects", value: 5 } },
      ],
    );
    const n = await backfillSearchText(payload as never, ["en", "fr"]);
    expect(n).toBe(4);
    expect(payload.updates.map((u) => [u.id, u.text])).toEqual([[1, "alpha beta"], [2, ""], [3, ""], [4, ""]]);
    expect(await backfillSearchText(payload as never, ["en"])).toBe(0);
  });
});
