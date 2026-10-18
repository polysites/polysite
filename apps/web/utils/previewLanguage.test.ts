import { describe, expect, it } from "vitest";

import { signPreview, verifyPreview } from "./previewLanguage";

const now = Date.UTC(2026, 9, 18, 12, 0, 0);

describe("signed preview links", () => {
  it("opens the language it was made for, on the host it was made for", async () => {
    const token = await signPreview("secret-one", "Site.Example", "fr", now);
    expect(await verifyPreview("secret-one", "site.example", token, now + 1000)).toBe("fr");
  });

  it("refuses another host, another secret, a tampered language or expiry, and an empty secret", async () => {
    const token = await signPreview("secret-one", "site.example", "fr", now);
    expect(await verifyPreview("secret-one", "other.example", token, now)).toBeNull();
    expect(await verifyPreview("secret-two", "site.example", token, now)).toBeNull();
    expect(await verifyPreview("secret-one", "site.example", token.replace(/^fr/, "de"), now)).toBeNull();
    expect(await verifyPreview("secret-one", "site.example", token.replace(/\.(\d+)\./, (_m, n) => `.${Number(n) + 1}.`), now)).toBeNull();
    expect(await verifyPreview("", "site.example", token, now)).toBeNull();
  });

  it("expires after twelve hours", async () => {
    const token = await signPreview("secret-one", "site.example", "ar", now);
    expect(await verifyPreview("secret-one", "site.example", token, now + 11 * 3600 * 1000)).toBe("ar");
    expect(await verifyPreview("secret-one", "site.example", token, now + 13 * 3600 * 1000)).toBeNull();
  });

  it("refuses anything that is not a token", async () => {
    for (const bad of [undefined, null, 5, "", "fr", "fr.1.2", "fr.99999999999.zz", ["fr.1.a"]]) expect(await verifyPreview("s", "h", bad, now)).toBeNull();
  });
});
