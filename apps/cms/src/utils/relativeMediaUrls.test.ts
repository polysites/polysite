import { describe, expect, it } from "vitest";

import { relativizeUploadUrls, toPath } from "./relativeMediaUrls";

describe("toPath", () => {
  it("strips the origin and keeps the query", () => {
    expect(toPath("http://polysite.localhost/api/media/file/a.webp?x=1")).toBe("/api/media/file/a.webp?x=1");
  });
  it("leaves relative paths, nulls and non-strings alone", () => {
    expect(toPath("/api/media/file/a.webp")).toBe("/api/media/file/a.webp");
    expect(toPath(null)).toBeNull();
    expect(toPath(undefined)).toBeUndefined();
  });
});

describe("relativizeUploadUrls", () => {
  it("rewrites url, thumbnailURL and every size url", () => {
    const doc = relativizeUploadUrls({
      url: "https://cms.example.com/api/media/file/a.webp",
      thumbnailURL: null,
      sizes: {
        card: { url: "https://cms.example.com/api/media/file/a-800x533.jpg" },
        thumbnail: { url: null },
      },
    });
    expect(doc.url).toBe("/api/media/file/a.webp");
    expect(doc.thumbnailURL).toBeNull();
    expect(doc.sizes?.card?.url).toBe("/api/media/file/a-800x533.jpg");
    expect(doc.sizes?.thumbnail?.url).toBeNull();
  });
});
