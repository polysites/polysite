import { describe, expect, it } from "vitest";

import { createStringRegistry } from "./strings";

describe("the fixed words of a site", () => {
  it("shows the English written in the code when a language has no dictionary or no entry", () => {
    const strings = createStringRegistry();
    expect(strings.translate("fr", "form.thanks", "Thank you.")).toBe("Thank you.");
    strings.register("fr", { "form.other": "Autre" });
    expect(strings.translate("fr", "form.thanks", "Thank you.")).toBe("Thank you.");
  });

  it("uses a registered translation, and a later registration adds to it rather than replacing it", () => {
    const strings = createStringRegistry();
    strings.register("fr", { "form.thanks": "Merci." });
    strings.register("fr", { "form.error": "Erreur." });
    expect(strings.translate("fr", "form.thanks", "Thank you.")).toBe("Merci.");
    expect(strings.translate("fr", "form.error", "Error.")).toBe("Erreur.");
  });

  it("lets a theme override a word another layer registered", () => {
    const strings = createStringRegistry();
    strings.register("fr", { "form.thanks": "Merci." });
    strings.register("fr", { "form.thanks": "Merci beaucoup !" });
    expect(strings.translate("fr", "form.thanks", "Thank you.")).toBe("Merci beaucoup !");
  });

  it("tries the language without its region, so pt-BR can lean on pt", () => {
    const strings = createStringRegistry();
    strings.register("pt", { "form.thanks": "Obrigado." });
    strings.register("pt-BR", { "form.error": "Erro." });
    expect(strings.translate("pt-BR", "form.thanks", "Thank you.")).toBe("Obrigado.");
    expect(strings.translate("pt-BR", "form.error", "Error.")).toBe("Erro.");
    expect(strings.translate("pt", "form.error", "Error.")).toBe("Error.");
  });

  it("fills in values, and leaves an unknown placeholder visible rather than crashing", () => {
    const strings = createStringRegistry();
    strings.register("fr", { "list.page": "Page {page} sur {total}" });
    expect(strings.translate("fr", "list.page", "Page {page} of {total}", { page: 2, total: 5 })).toBe("Page 2 sur 5");
    expect(strings.translate("en", "list.page", "Page {page} of {total}", { page: 2 })).toBe("Page 2 of {total}");
  });
});
