import { describe, expect, it } from "vitest";

import { isSafeLinkUrl } from "./safeUrl";

describe("isSafeLinkUrl", () => {
  it("allows blank, paths and http(s) addresses", () => {
    for (const ok of ["", "  ", "/privacy", "/a/b?c=1", "https://example.org/privacy", "http://example.org"]) {
      expect(isSafeLinkUrl(ok), ok).toBe(true);
    }
  });

  it("refuses script-like, protocol-relative and malformed values", () => {
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "//evil.example", "example.org/privacy", "mailto:a@b.c", "ftp://x"]) {
      expect(isSafeLinkUrl(bad), bad).toBe(false);
    }
  });
});
