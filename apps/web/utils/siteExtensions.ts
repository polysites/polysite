// The two generic hooks a plugin's web layer uses to add behaviour to every page without the core knowing what it is:
//
//  - slots: named places in the page chrome ("app" renders once for the whole app, "footer-links" renders where a
//    layout puts <SiteSlot name="footer-links" />) that a plugin fills with its own components;
//  - site events: things that happen in the visitor's browser (a form was sent) that a plugin can listen for.
//
// A plugin registers from its own Nuxt plugin (`dependsOn: ["site-extensions"]`). With no plugin installed every
// slot is empty and every event has no listener, so the core is unaffected.
import { markRaw, shallowReactive, type Component } from "vue";

export interface SiteSlots {
  /** Adds a component to a slot. Adding the same component twice to one slot is a no-op. */
  add(slot: string, component: Component): void;
  list(slot: string): Component[];
  has(slot: string): boolean;
}

export function createSiteSlots(): SiteSlots {
  const slots = shallowReactive<Record<string, Component[]>>({});
  return {
    add(slot, component) {
      const current = slots[slot] ?? [];
      if (current.includes(component)) return;
      slots[slot] = [...current, markRaw(component)];
    },
    list: (slot) => slots[slot] ?? [],
    has: (slot) => (slots[slot]?.length ?? 0) > 0,
  };
}

/** What happens in the browser that a plugin may care about. Events carry ids and names, never what a visitor typed. */
export type SiteEvent = { name: "form_submit"; formId: string | number } | { name: "page_view"; path: string; title: string };

type Listener = (event: SiteEvent) => void;
const listeners = new Set<Listener>();

/** Listens for site events (browser only). Returns a function that stops listening. */
export function onSiteEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Tells every listener. A no-op when nothing listens, so callers never need to know whether a plugin is installed. */
export function emitSiteEvent(event: SiteEvent): void {
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch {
      /* one listener failing must not stop the others, or the visitor's action */
    }
  }
}
