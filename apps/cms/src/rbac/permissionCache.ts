import type { Payload } from "payload";

// A capability check (hasCapability, in access/roles.ts) runs on every
// single request, so it can't be a DB round-trip each time -- the whole
// Roles collection (a handful of documents, not a growth table) is cached
// in memory instead, populated once at boot (loadPermissionCache, called
// from payload.config.ts's onInit) and kept fresh by Roles.ts's own
// afterChange/afterDelete hooks below. A Super Admin editing a role in the
// admin UI takes effect on the very next request, no restart -- that's the
// actual point of this cache existing at all, not just a perf optimization.
export type CachedRole = {
  id: string;
  name: string;
  modules: string[];
  operations: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
    publish: boolean;
    unpublish: boolean;
    cloneAcrossSites: boolean;
  };
  manageSiteSettings: boolean;
};

const cache = new Map<string, CachedRole>();

// Structural, not the generated `Role` type: that type's `id` is a strict
// `number` (a real Postgres id always is), but this cache is also seeded
// directly by roles.test.ts with string test-fixture ids, and `id` is
// String()'d immediately below either way -- the cache has never cared
// which primitive it started as.
interface RoleLike {
  id: number | string;
  name: string;
  modules?: string[] | null;
  operations?: {
    create?: boolean | null;
    read?: boolean | null;
    update?: boolean | null;
    delete?: boolean | null;
    publish?: boolean | null;
    unpublish?: boolean | null;
    cloneAcrossSites?: boolean | null;
  } | null;
  manageSiteSettings?: boolean | null;
}

function toCachedRole(doc: RoleLike): CachedRole {
  return {
    id: String(doc.id),
    name: doc.name,
    modules: Array.isArray(doc.modules) ? doc.modules : [],
    operations: {
      create: Boolean(doc.operations?.create),
      read: Boolean(doc.operations?.read),
      update: Boolean(doc.operations?.update),
      delete: Boolean(doc.operations?.delete),
      publish: Boolean(doc.operations?.publish),
      unpublish: Boolean(doc.operations?.unpublish),
      cloneAcrossSites: Boolean(doc.operations?.cloneAcrossSites),
    },
    manageSiteSettings: Boolean(doc.manageSiteSettings),
  };
}

// Called once from payload.config.ts's onInit. A cache miss before this
// runs (or if it fails) means getCachedRole returns undefined for every
// role -- hasCapability's default-deny already treats that as "no access",
// never as "allow everything", so a slow/failed boot fails closed, not open.
export async function loadPermissionCache(payload: Payload): Promise<void> {
  const { docs } = await payload.find({
    collection: "roles",
    limit: 0,
    depth: 0,
    overrideAccess: true,
  });
  cache.clear();
  for (const doc of docs) {
    cache.set(String(doc.id), toCachedRole(doc));
  }
}

export function getCachedRole(roleId: string | undefined | null): CachedRole | undefined {
  if (!roleId) return undefined;
  return cache.get(String(roleId));
}

// Wired as Roles.ts's afterChange hook.
export function upsertCachedRole(doc: RoleLike): void {
  cache.set(String(doc.id), toCachedRole(doc));
}

// Wired as Roles.ts's afterDelete hook.
export function removeCachedRole(id: string | number): void {
  cache.delete(String(id));
}
