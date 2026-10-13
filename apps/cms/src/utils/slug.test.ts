import { describe, expect, it } from "vitest";

import { nextFreeCopySlug, normalizeSlug } from "./slug";

describe("normalizeSlug", () => {
  it("preserves the homepage sentinel slug", () => {
    // Regression test: a bare "/" used to collapse to "" on every resave
    // (even one that never touched slug), 404ing the site root in
    // production -- see this function's own comment for the incident.
    expect(normalizeSlug("/")).toBe("/");
  });

  it("strips leading and trailing slashes from a real path", () => {
    expect(normalizeSlug("/about/")).toBe("about");
  });

  it("lowercases and hyphenates each segment independently", () => {
    expect(normalizeSlug("About Us/Our Team")).toBe("about-us/our-team");
  });

  it("collapses repeated separators within a segment", () => {
    expect(normalizeSlug("foo---bar")).toBe("foo-bar");
  });

  it("preserves nested slug structure", () => {
    expect(normalizeSlug("about/team")).toBe("about/team");
  });
});

describe("nextFreeCopySlug", () => {
  const taken = (...used: string[]) => async (c: string) => used.includes(c);
  it("turns the homepage slug into home-copy", async () => {
    expect(await nextFreeCopySlug("/", taken())).toBe("home-copy");
  });
  it("appends -copy, then -2, -3 while taken", async () => {
    expect(await nextFreeCopySlug("about", taken())).toBe("about-copy");
    expect(await nextFreeCopySlug("about", taken("about-copy"))).toBe("about-copy-2");
    expect(await nextFreeCopySlug("about", taken("about-copy", "about-copy-2"))).toBe("about-copy-3");
  });
  it("keeps nested slugs", async () => {
    expect(await nextFreeCopySlug("about/team", taken())).toBe("about/team-copy");
  });
});
