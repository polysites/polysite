import { afterEach, describe, expect, it } from "vitest";

import { removeCachedRole, upsertCachedRole } from "../rbac/permissionCache";
import { canManageSiteSettings, hasCapability, isSuperAdmin, userSiteIds } from "./roles";

// hasCapability/canManageSiteSettings read the in-memory permission cache,
// not the database -- upsertCachedRole/removeCachedRole (the same functions
// Roles.ts's own afterChange/afterDelete hooks call) let these tests seed
// and tear down fake roles without touching Postgres or Payload at all.
const ROLE_ID = "test-role-editor";

function seedRole(overrides: Partial<Parameters<typeof upsertCachedRole>[0]> = {}) {
  upsertCachedRole({
    id: ROLE_ID,
    name: "Test Editor",
    modules: ["pages"],
    operations: {
      create: true,
      read: true,
      update: true,
      delete: false,
      publish: false,
      unpublish: false,
      cloneAcrossSites: false,
    },
    manageSiteSettings: false,
    ...overrides,
  });
}

afterEach(() => {
  removeCachedRole(ROLE_ID);
});

describe("isSuperAdmin", () => {
  it("is true only for an exact boolean true", () => {
    expect(isSuperAdmin({ isSuperAdmin: true })).toBe(true);
  });

  it("is false for anything else, including no user", () => {
    expect(isSuperAdmin({ isSuperAdmin: false })).toBe(false);
    expect(isSuperAdmin({})).toBe(false);
    expect(isSuperAdmin(undefined)).toBe(false);
  });
});

describe("userSiteIds", () => {
  it("reads ids out of both populated and unpopulated assignedSites rows", () => {
    const user = { assignedSites: [{ site: "site-1" }, { site: { id: "site-2" } }] };
    expect(userSiteIds(user)).toEqual(["site-1", "site-2"]);
  });

  it("returns an empty array when assignedSites is missing", () => {
    expect(userSiteIds({})).toEqual([]);
    expect(userSiteIds(undefined)).toEqual([]);
  });
});

describe("hasCapability", () => {
  it("bypasses the role matrix entirely for a super admin", () => {
    const user = { isSuperAdmin: true };
    expect(hasCapability(user, "anything", "delete")).toBe(true);
  });

  it("denies when the user's role doesn't exist in the cache", () => {
    const user = { role: "missing-role" };
    expect(hasCapability(user, "pages", "read")).toBe(false);
  });

  it("denies when the role doesn't list the module", () => {
    seedRole();
    const user = { role: ROLE_ID };
    expect(hasCapability(user, "redirects", "read")).toBe(false);
  });

  it("denies when the module is listed but the operation is off", () => {
    seedRole();
    const user = { role: ROLE_ID };
    expect(hasCapability(user, "pages", "delete")).toBe(false);
  });

  it("allows when the module is listed and the operation is on", () => {
    seedRole();
    const user = { role: ROLE_ID };
    expect(hasCapability(user, "pages", "create")).toBe(true);
  });

  it("resolves a populated role relationship the same as a bare id", () => {
    seedRole();
    const user = { role: { id: ROLE_ID } };
    expect(hasCapability(user, "pages", "read")).toBe(true);
  });
});

describe("canManageSiteSettings", () => {
  it("is true for a super admin regardless of role", () => {
    expect(canManageSiteSettings({ isSuperAdmin: true })).toBe(true);
  });

  it("follows the role's manageSiteSettings flag", () => {
    seedRole({ manageSiteSettings: true });
    expect(canManageSiteSettings({ role: ROLE_ID })).toBe(true);
  });

  it("denies when the role doesn't grant it", () => {
    seedRole({ manageSiteSettings: false });
    expect(canManageSiteSettings({ role: ROLE_ID })).toBe(false);
  });

  it("denies when the role can't be resolved at all", () => {
    expect(canManageSiteSettings({ role: "missing-role" })).toBe(false);
  });
});
