import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("payload", () => ({
  createLocalReq: vi.fn(async (opts: { context?: Record<string, unknown> }) => ({ context: opts.context ?? {} })),
}));

import { runSetup, SetupError } from "./runSetup";
import type { SetupValue } from "./validate";

const value: SetupValue = {
  email: "admin@example.org",
  password: "a-long-enough-password",
  siteName: "Example",
  domain: "example.org",
  theme: "starter",
  createHomePage: true,
  setupToken: "",
};

function fakePayload(opts: { users?: number; roles?: { id: number }[]; failOn?: string } = {}) {
  const calls: string[] = [];
  const payload = {
    count: vi.fn(async () => ({ totalDocs: opts.users ?? 0 })),
    find: vi.fn(async () => ({ docs: opts.roles ?? [{ id: 7 }] })),
    create: vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
      calls.push(collection);
      if (opts.failOn === collection) throw new Error(`${collection} failed`);
      return { id: collection === "sites" ? 11 : 1, ...data };
    }),
    db: {
      beginTransaction: vi.fn(async () => "tx1"),
      commitTransaction: vi.fn(async () => undefined),
      rollbackTransaction: vi.fn(async () => undefined),
    },
  };
  return { payload: payload as never, calls, db: payload.db, create: payload.create };
}

describe("runSetup", () => {
  beforeEach(() => {
    delete process.env.POLYSITE_SETUP_TOKEN;
  });
  afterEach(() => {
    delete process.env.POLYSITE_SETUP_TOKEN;
  });

  it("creates the Super Admin, the site and the home page, then commits", async () => {
    const { payload, calls, db, create } = fakePayload();
    await expect(runSetup(payload, value)).resolves.toEqual({ siteId: 11 });
    expect(calls).toEqual(["users", "sites", "pages"]);
    expect(db.commitTransaction).toHaveBeenCalledWith("tx1");
    expect(db.rollbackTransaction).not.toHaveBeenCalled();
    expect(create.mock.calls[0]![0].data).toMatchObject({ email: "admin@example.org", isSuperAdmin: true, role: 7 });
  });

  it("skips the home page when asked", async () => {
    const { payload, calls } = fakePayload();
    await runSetup(payload, { ...value, createHomePage: false });
    expect(calls).toEqual(["users", "sites"]);
  });

  it("refuses once any user exists", async () => {
    const { payload, calls } = fakePayload({ users: 1 });
    await expect(runSetup(payload, value)).rejects.toMatchObject({ status: 409 });
    expect(calls).toEqual([]);
  });

  it("rolls everything back when a later step fails", async () => {
    const { payload, db } = fakePayload({ failOn: "sites" });
    await expect(runSetup(payload, value)).rejects.toThrow("sites failed");
    expect(db.rollbackTransaction).toHaveBeenCalledWith("tx1");
    expect(db.commitTransaction).not.toHaveBeenCalled();
  });

  it("explains a missing default role instead of creating a half-set-up admin", async () => {
    const { payload, calls } = fakePayload({ roles: [] });
    await expect(runSetup(payload, value)).rejects.toMatchObject({ status: 500 });
    expect(calls).toEqual([]);
  });

  it("requires the setup token when one is configured", async () => {
    process.env.POLYSITE_SETUP_TOKEN = "s3cret-token";
    const { payload, calls } = fakePayload();
    await expect(runSetup(payload, { ...value, setupToken: "wrong" })).rejects.toBeInstanceOf(SetupError);
    expect(calls).toEqual([]);
    await expect(runSetup(payload, { ...value, setupToken: "s3cret-token" })).resolves.toBeTruthy();
  });
});

describe("open setup over https", () => {
  it("is refused unless a token guards it or it is allowed on purpose", async () => {
    const { openSetupRefused } = await import("./policy");
    expect(openSetupRefused({ CMS_SCHEME: "https" })).toBe(true);
    expect(openSetupRefused({ CMS_SCHEME: "https", POLYSITE_SETUP_TOKEN: "t" })).toBe(false);
    expect(openSetupRefused({ CMS_SCHEME: "https", POLYSITE_ALLOW_OPEN_SETUP: "1" })).toBe(false);
    expect(openSetupRefused({ CMS_SCHEME: "http" })).toBe(false);
    expect(openSetupRefused({})).toBe(false);
  });
});
