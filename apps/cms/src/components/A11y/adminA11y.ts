// Accessible names for a few controls Payload's stock admin renders without one (an automated axe pass found them: unnamed menu
// buttons, drag handles and select inputs, empty checkbox labels, focusable decorative icons). The markup is Payload's, so it is
// repaired after it renders, here, in one small and idempotent place: an element that already has a name is never touched, and
// nothing about behaviour changes. Installed once from the sidebar (components/AdminNav/NavClient.tsx), which every admin page
// except sign-in carries, and kept up to date with a MutationObserver because Payload renders most of these on demand.

/** What a row of the popup-button family does, from where it sits. `inside` answers "is this button inside an element matching...". */
export function popupLabel(inside: (selector: string) => boolean): string {
  if (inside(".doc-controls__popup")) return "Document actions";
  if (inside(".array-actions")) return "Row actions";
  if (inside(".clipboard-action")) return "Copy or paste blocks";
  return "More actions";
}

/** The visible label of a field, without the "required" star or the "— English" language suffix, for naming its select input. */
export function fieldLabelText(raw: string | null | undefined): string {
  const text = (raw ?? "").replace(/\s+/g, " ").replace(/[*]/g, "").split(/[—–]/)[0].trim();
  return text || "Choose an option";
}

export function checkboxLabel(id: string | null | undefined): string {
  return id === "select-all" ? "Select all rows" : "Select row";
}

const hasName = (el: Element): boolean =>
  Boolean((el.getAttribute("aria-label") ?? "").trim() || el.getAttribute("aria-labelledby") || (el.getAttribute("title") ?? "").trim() || (el.textContent ?? "").trim());

/** Repairs what is currently in `root`. Returns how many elements were changed (0 once everything is named). */
export function applyAdminA11y(root: ParentNode): number {
  let changed = 0;
  const set = (el: Element, name: string, value: string) => {
    el.setAttribute(name, value);
    changed += 1;
  };

  for (const el of root.querySelectorAll("button.popup-button")) {
    if (!hasName(el)) set(el, "aria-label", popupLabel((s) => el.closest(s) !== null));
  }
  for (const el of root.querySelectorAll('.collapsible__drag[role="button"]')) {
    if (!(el.getAttribute("aria-label") ?? "").trim()) set(el, "aria-label", "Drag to reorder");
  }
  for (const el of root.querySelectorAll('input.rs__input, input[role="combobox"][id^="react-select-"]')) {
    if ((el.getAttribute("aria-label") ?? "").trim() || el.getAttribute("aria-labelledby")) continue;
    const field = el.closest(".field-type");
    set(el, "aria-label", fieldLabelText(field?.querySelector("label")?.textContent));
  }
  for (const el of root.querySelectorAll('input[type="checkbox"][aria-label=""]')) {
    // Payload points the select-all box's aria-labelledby at itself, which names nothing.
    el.removeAttribute("aria-labelledby");
    set(el, "aria-label", checkboxLabel(el.getAttribute("id")));
  }
  // Decorative icons of a select that are hidden from assistive technology but still reachable with Tab: the combobox input is the keyboard route.
  for (const el of root.querySelectorAll('.clear-indicator[aria-hidden="true"], .dropdown-indicator[aria-hidden="true"]')) {
    if (el.getAttribute("tabindex") !== "-1") set(el, "tabindex", "-1");
  }
  // An <ul> that holds <div> children is not a list; its children are the tabs themselves.
  for (const el of root.querySelectorAll("ul.doc-tabs__tabs")) {
    if (el.getAttribute("role") !== "presentation") set(el, "role", "presentation");
  }
  // A link with nothing in it (the SEO plugin's search-result preview before a title exists) is decorative.
  for (const el of root.querySelectorAll("a[href]")) {
    if (!hasName(el) && !el.querySelector("img, svg") && el.getAttribute("aria-hidden") !== "true") {
      el.setAttribute("aria-hidden", "true");
      set(el, "tabindex", "-1");
    }
  }
  return changed;
}

/** Starts repairing the document now and whenever Payload adds to it. Returns a function that stops it. */
export function installAdminA11y(doc: Document = document): () => void {
  let queued = false;
  const run = () => {
    queued = false;
    applyAdminA11y(doc);
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    (doc.defaultView ?? window).setTimeout(run, 150);
  };
  run();
  const observer = new MutationObserver(schedule);
  observer.observe(doc.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
