import { describe, expect, it } from "vitest";

import { checkboxLabel, fieldLabelText, popupLabel } from "./adminA11y";

describe("popupLabel", () => {
  const within = (cls: string) => (selector: string) => selector === cls;
  it("names a popup button by where it sits", () => {
    expect(popupLabel(within(".doc-controls__popup"))).toBe("Document actions");
    expect(popupLabel(within(".array-actions"))).toBe("Row actions");
    expect(popupLabel(within(".clipboard-action"))).toBe("Copy or paste blocks");
  });
  it("falls back to a generic name rather than leaving the button unnamed", () => {
    expect(popupLabel(() => false)).toBe("More actions");
  });
  it("prefers the document menu when a button matches several containers", () => {
    expect(popupLabel(() => true)).toBe("Document actions");
  });
});

describe("fieldLabelText", () => {
  it("drops the required star and the language suffix", () => {
    expect(fieldLabelText("Title— English")).toBe("Title");
    expect(fieldLabelText("Site *")).toBe("Site");
    expect(fieldLabelText("  Related   pages \n")).toBe("Related pages");
  });
  it("falls back when there is no label", () => {
    expect(fieldLabelText(null)).toBe("Choose an option");
    expect(fieldLabelText("")).toBe("Choose an option");
  });
});

describe("checkboxLabel", () => {
  it("tells the select-all box from a row's box", () => {
    expect(checkboxLabel("select-all")).toBe("Select all rows");
    expect(checkboxLabel("_R_1q_")).toBe("Select row");
    expect(checkboxLabel(null)).toBe("Select row");
  });
});
