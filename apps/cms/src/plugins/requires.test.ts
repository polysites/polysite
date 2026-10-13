import { describe, expect, it } from "vitest";

import { checkRequires } from "./requires";

describe("a plugin's required core version", () => {
  it("loads when nothing is required", () => {
    expect(checkRequires(undefined, "0.1.0")).toBeNull();
    expect(checkRequires("", "0.1.0")).toBeNull();
  });
  it("compares each comparator against the running version", () => {
    expect(checkRequires(">=0.1.0", "0.1.0")).toBeNull();
    expect(checkRequires(">=0.1.0", "0.10.2")).toBeNull();
    expect(checkRequires(">=0.2.0", "0.1.9")).toMatch(/needs Polysite >=0.2.0, and this is 0.1.9/);
    expect(checkRequires(">=0.1.0 <0.3.0", "0.2.5")).toBeNull();
    expect(checkRequires(">=0.1.0 <0.3.0", "0.3.0")).not.toBeNull();
    expect(checkRequires("0.1.0", "0.1.0")).toBeNull();
    expect(checkRequires("=0.1.0", "0.1.1")).not.toBeNull();
    expect(checkRequires(">0.1.0", "0.1.0")).not.toBeNull();
  });
  it("treats a pre-release core as the release it leads to", () => {
    expect(checkRequires(">=0.2.0", "0.2.0-beta.1")).toBeNull();
    expect(checkRequires("<0.2.0", "0.2.0-beta.1")).not.toBeNull();
  });
  it("accepts every plugin on a development build", () => {
    expect(checkRequires(">=9.0.0", "dev")).toBeNull();
    expect(checkRequires(">=9.0.0", undefined)).toBeNull();
  });
  it("says so when the range cannot be read, even on a development build", () => {
    expect(checkRequires("^0.1.0", "dev")).toMatch(/cannot read/);
    expect(checkRequires(42, "0.1.0")).toMatch(/must be a string/);
  });
});
