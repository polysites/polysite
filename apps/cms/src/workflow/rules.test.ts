import { describe, expect, it } from "vitest";

import { capabilityNeeded, changesLiveSite, clearsReview, isDraftRequest, slugToRedirectFrom } from "./rules";

describe("which capability a save needs", () => {
  it("needs nothing beyond editing for a draft save, whatever is live", () => {
    for (const liveStatus of ["draft", "published", undefined] as const) {
      expect(capabilityNeeded({ isDraftSave: true, requestedStatus: "draft", liveStatus })).toBeNull();
      expect(capabilityNeeded({ isDraftSave: true, requestedStatus: "published", liveStatus })).toBeNull();
    }
  });

  it("needs publish to publish, including a first publish and a re-publish", () => {
    expect(capabilityNeeded({ isDraftSave: false, requestedStatus: "published", liveStatus: "draft" })).toBe("publish");
    expect(capabilityNeeded({ isDraftSave: false, requestedStatus: "published", liveStatus: "published" })).toBe("publish");
    expect(capabilityNeeded({ isDraftSave: false, requestedStatus: "published", liveStatus: undefined })).toBe("publish");
  });

  it("treats an ordinary save of a live page as a publish, because it changes what visitors see", () => {
    expect(capabilityNeeded({ isDraftSave: false, requestedStatus: undefined, liveStatus: "published" })).toBe("publish");
  });

  it("needs unpublish to take a live page down, and nothing to leave a draft a draft", () => {
    expect(capabilityNeeded({ isDraftSave: false, requestedStatus: "draft", liveStatus: "published" })).toBe("unpublish");
    expect(capabilityNeeded({ isDraftSave: false, requestedStatus: "draft", liveStatus: "draft" })).toBeNull();
    expect(capabilityNeeded({ isDraftSave: false, requestedStatus: "draft", liveStatus: undefined })).toBeNull();
    expect(capabilityNeeded({ isDraftSave: false, requestedStatus: undefined, liveStatus: undefined })).toBeNull();
  });
});

describe("reading the draft flag", () => {
  it("accepts the string and the boolean, and nothing else", () => {
    expect(isDraftRequest({ draft: "true" })).toBe(true);
    expect(isDraftRequest({ draft: true })).toBe(true);
    for (const query of [{}, { draft: "false" }, { draft: false }, { draft: "1" }, undefined, null]) expect(isDraftRequest(query)).toBe(false);
  });
});

describe("what a save does to the public site", () => {
  it("leaves it alone for a draft save and refreshes it otherwise", () => {
    expect(changesLiveSite({ isDraftSave: true })).toBe(false);
    expect(changesLiveSite({ isDraftSave: false })).toBe(true);
  });
});

describe("when a changed address needs a redirect", () => {
  it("redirects from the old LIVE address when a publish changes it", () => {
    expect(slugToRedirectFrom({ isDraftSave: false, liveSlugBefore: "about", slugAfter: "about-us" })).toBe("about");
  });

  it("does nothing for a draft save, even if the draft has a new address", () => {
    expect(slugToRedirectFrom({ isDraftSave: true, liveSlugBefore: "about", slugAfter: "about-us" })).toBeNull();
  });

  it("does nothing when the address is unchanged, or there was no live version", () => {
    expect(slugToRedirectFrom({ isDraftSave: false, liveSlugBefore: "about", slugAfter: "about" })).toBeNull();
    expect(slugToRedirectFrom({ isDraftSave: false, liveSlugBefore: undefined, slugAfter: "about" })).toBeNull();
    expect(slugToRedirectFrom({ isDraftSave: false, liveSlugBefore: "about", slugAfter: undefined })).toBeNull();
  });
});

describe("when publishing clears the review marker", () => {
  it("clears it on a publish, never on a draft save or an unpublish", () => {
    expect(clearsReview({ isDraftSave: false, requestedStatus: "published" })).toBe(true);
    expect(clearsReview({ isDraftSave: true, requestedStatus: "published" })).toBe(false);
    expect(clearsReview({ isDraftSave: true, requestedStatus: "draft" })).toBe(false);
    expect(clearsReview({ isDraftSave: false, requestedStatus: "draft" })).toBe(false);
    expect(clearsReview({ isDraftSave: false, requestedStatus: undefined })).toBe(false);
  });
});
