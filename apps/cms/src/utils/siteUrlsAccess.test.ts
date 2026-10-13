import { afterEach, describe, expect, it } from "vitest";

import { removeCachedRole, upsertCachedRole } from "../rbac/permissionCache";
import { siteUrlsRead, siteUrlsWrite } from "./siteUrlsAccess";

const ops = { create: false, read: true, update: false, delete: false, publish: false, unpublish: false, cloneAcrossSites: false };
const asReq = (user: unknown) => ({ req: { user } }) as never;
const read = siteUrlsRead(["pages", "redirects", "posts"]);

afterEach(() => {
  removeCachedRole("r-editor");
  removeCachedRole("r-media");
});

describe("site URL index: read", () => {
  it("shows a visitor only live entries (a draft's title and address stay private)", () => {
    expect(read(asReq(null))).toEqual({ status: { in: ["published", "active"] } });
  });
  it("shows a signed-in person with no content permission only live entries too", () => {
    upsertCachedRole({ id: "r-media", name: "Media only", modules: ["media"], operations: ops, manageSiteSettings: false });
    expect(read(asReq({ role: "r-media" }))).toEqual({ status: { in: ["published", "active"] } });
  });
  it("shows everything to a Super Admin and to anyone who can read an indexed kind of content", () => {
    upsertCachedRole({ id: "r-editor", name: "Editor", modules: ["posts"], operations: ops, manageSiteSettings: false });
    expect(read(asReq({ isSuperAdmin: true }))).toBe(true);
    expect(read(asReq({ role: "r-editor" }))).toBe(true);
  });
});

describe("site URL index: change and delete", () => {
  it("is for Super Admins and site administrators only", () => {
    upsertCachedRole({ id: "r-editor", name: "Editor", modules: ["pages"], operations: { ...ops, update: true, delete: true }, manageSiteSettings: false });
    upsertCachedRole({ id: "r-media", name: "Site admin", modules: ["pages"], operations: ops, manageSiteSettings: true });
    expect(siteUrlsWrite(asReq(null))).toBe(false);
    expect(siteUrlsWrite(asReq({ role: "r-editor" }))).toBe(false);
    expect(siteUrlsWrite(asReq({ role: "r-media" }))).toBe(true);
    expect(siteUrlsWrite(asReq({ isSuperAdmin: true }))).toBe(true);
  });
});
