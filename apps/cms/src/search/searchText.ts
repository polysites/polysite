import type { Payload } from "payload";

import { extractSearchText, type SearchTextOption } from "./extractText";

// The index (`site-urls`) holds the text of what is LIVE, in one row per language, and only for published entries: a draft that
// was never published, or a redirect, has an empty string, so unpublished words never reach the index.

type Collections = Record<string, { config: { fields?: unknown; custom?: { polysite?: { searchText?: boolean | SearchTextOption } } } } | undefined>;

/** The text to store for one live document ("" unless it is published). */
export function searchTextFor(payload: Payload, collectionSlug: string, doc: Record<string, unknown> | null | undefined): string {
  if (!doc || collectionSlug === "redirects") return "";
  const status = doc._status ?? doc.status;
  if (status !== "published") return "";
  const config = (payload.collections as unknown as Collections)[collectionSlug]?.config;
  if (!config) return "";
  return extractSearchText(doc, config.fields, config.custom?.polysite?.searchText);
}

const BATCH = 100;

/**
 * Gives index rows from before `searchText` existed their text, once, in the background at start. A row needs it when it has a
 * title in a language (so it has a row there) but no searchText. Every row is given a string (empty when there is nothing), so a
 * row is looked at once. The admin's Reindex button does the same for everything, by hand.
 */
export async function backfillSearchText(payload: Payload, localeCodes: string[]): Promise<number> {
  let done = 0;
  for (const locale of localeCodes) {
    let last = 0;
    for (;;) {
      const page = await payload.find({
        collection: "site-urls" as never,
        where: { and: [{ title: { exists: true } }, { searchText: { exists: false } }, { id: { greater_than: last } }] },
        locale: locale as never,
        fallbackLocale: false,
        depth: 0,
        limit: BATCH,
        pagination: false,
        sort: "id",
        overrideAccess: true,
        select: { doc: true, status: true } as never,
      });
      const rows = page.docs as unknown as { id: number; doc?: { relationTo: string; value: unknown } }[];
      if (rows.length === 0) break;
      for (const row of rows) {
        last = Math.max(last, row.id);
        let text = "";
        try {
          const ref = row.doc;
          const id = ref && typeof ref.value === "object" && ref.value ? (ref.value as { id: number }).id : ref?.value;
          if (ref && id !== undefined && id !== null && ref.relationTo !== "redirects") {
            const live = await payload.findByID({ collection: ref.relationTo as never, id: id as never, draft: false, locale: locale as never, depth: 0, overrideAccess: true });
            text = searchTextFor(payload, ref.relationTo, live as unknown as Record<string, unknown>);
          }
        } catch {
          // The document is gone or unreadable: an empty text. The index entry is removed with the document anyway.
        }
        await payload.update({ collection: "site-urls" as never, id: row.id, locale: locale as never, data: { searchText: text } as never, depth: 0, overrideAccess: true });
        done += 1;
      }
    }
  }
  return done;
}
