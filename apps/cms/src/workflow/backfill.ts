import type { CollectionSlug, Payload } from "payload";

// Documents that existed before drafts were switched on have no version history, and Payload's admin list for a collection
// with drafts is built from the versions table: such a document would be live on the site but missing from the list. So at
// start-up every document that has no version yet is saved once, which writes its first version. It changes nothing a
// visitor or editor can see (the status stays as it was) and does nothing once every document has a version.
export async function backfillVersions(payload: Payload): Promise<number> {
  let made = 0;
  for (const config of payload.config.collections) {
    if (!config.versions || !config.versions.drafts) continue;
    const collection = config.slug as CollectionSlug;
    const docs = await payload.find({ collection, depth: 0, limit: 0, pagination: false, draft: false, overrideAccess: true, select: { _status: true } as never });
    for (const doc of docs.docs as unknown as { id: number | string; _status?: string }[]) {
      const existing = await payload.countVersions({ collection, where: { parent: { equals: doc.id } }, overrideAccess: true });
      if (existing.totalDocs > 0) continue;
      const published = doc._status === "published";
      await payload.update({
        collection,
        id: doc.id,
        data: { _status: published ? "published" : "draft" } as never,
        draft: !published,
        depth: 0,
        overrideAccess: true,
        context: { polysiteBackfill: true },
      });
      made += 1;
    }
  }
  if (made > 0) payload.logger.info(`Content workflow: wrote a first version for ${made} existing document(s)`);
  return made;
}
