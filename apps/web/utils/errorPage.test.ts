import { describe, expect, it } from "vitest";

import { errorCopy } from "./errorPage";
import { createStringRegistry } from "./strings";

const english = (_key: string, fallback: string) => fallback;

describe("the words on the error page", () => {
  it("says the page can't be found for a 404, in English by default", () => {
    const copy = errorCopy(404, english);
    expect(copy.heading).toBe("We can't find that page");
    expect(copy.title).toBe("Page not found");
    expect(copy.home).toBe("Go to the home page");
    expect(copy.back).toBe("Go back");
  });

  it("uses the server-error wording for any other status, or none", () => {
    for (const status of [500, 503, 403, undefined]) {
      const copy = errorCopy(status, english);
      expect(copy.heading).toBe("Something went wrong");
      expect(copy.title).toBe("Something went wrong");
      expect(copy.detail).toContain("on our side");
    }
  });

  it("follows the language: translated words where a dictionary has them, English for the rest", () => {
    const strings = createStringRegistry();
    strings.register("fr", { "error.notFound.heading": "Page introuvable", "error.home": "Retour à l’accueil" });
    const french = (key: string, fallback: string) => strings.translate("fr", key, fallback);
    const copy = errorCopy(404, french);
    expect(copy.heading).toBe("Page introuvable");
    expect(copy.home).toBe("Retour à l’accueil");
    expect(copy.back).toBe("Go back");
    // The 404 and the server error use different keys, so one translation doesn't leak into the other.
    expect(errorCopy(500, french).heading).toBe("Something went wrong");
  });
});
