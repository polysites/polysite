import { describe, expect, it, vi } from "vitest";

import { createSiteSlots, emitSiteEvent, onSiteEvent } from "./siteExtensions";

const A = { name: "A" };
const B = { name: "B" };

describe("site slots", () => {
  it("is empty until something is added", () => {
    const slots = createSiteSlots();
    expect(slots.has("app")).toBe(false);
    expect(slots.list("app")).toEqual([]);
  });

  it("keeps components in the order they were added, per slot", () => {
    const slots = createSiteSlots();
    slots.add("app", A);
    slots.add("app", B);
    slots.add("footer-links", A);
    expect(slots.list("app")).toHaveLength(2);
    expect(slots.list("footer-links")).toHaveLength(1);
    expect(slots.has("footer-links")).toBe(true);
  });

  it("ignores the same component added twice to one slot", () => {
    const slots = createSiteSlots();
    slots.add("app", A);
    slots.add("app", A);
    expect(slots.list("app")).toHaveLength(1);
  });
});

describe("site events", () => {
  it("does nothing when nobody listens", () => {
    expect(() => emitSiteEvent({ name: "form_submit", formId: 1 })).not.toThrow();
  });

  it("tells every listener, and a listener that throws doesn't stop the others", () => {
    const first = vi.fn(() => {
      throw new Error("boom");
    });
    const second = vi.fn();
    const stopFirst = onSiteEvent(first);
    const stopSecond = onSiteEvent(second);
    emitSiteEvent({ name: "form_submit", formId: 7 });
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledWith({ name: "form_submit", formId: 7 });
    stopFirst();
    stopSecond();
  });

  it("stops telling a listener once it unsubscribes", () => {
    const listener = vi.fn();
    const stop = onSiteEvent(listener);
    stop();
    emitSiteEvent({ name: "page_view", path: "/", title: "Home" });
    expect(listener).not.toHaveBeenCalled();
  });
});
