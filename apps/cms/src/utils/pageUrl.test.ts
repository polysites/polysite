import { describe, expect, it } from "vitest";

import { buildPageUrl } from "./pageUrl";

describe("buildPageUrl", () => {
  it("returns the bare origin for the homepage slug", () => {
    expect(buildPageUrl("voidslate.localhost", "/")).toBe("http://voidslate.localhost");
  });
  it("joins a nested slug without doubling slashes", () => {
    expect(buildPageUrl("bakery.localhost", "about/team", "https")).toBe("https://bakery.localhost/about/team");
    expect(buildPageUrl("bakery.localhost", "/about")).toBe("http://bakery.localhost/about");
  });
  it("falls back to the origin for a missing slug", () => {
    expect(buildPageUrl("a.test", undefined)).toBe("http://a.test");
  });
});
