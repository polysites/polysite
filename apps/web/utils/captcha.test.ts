import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { solveChallenge } from "./altchaSolver";
import { cleanUrl, hiddenValue } from "./hiddenFields";

const page = { origin: "https://example.org", pathname: "/join", search: "?utm_source=newsletter&ref=a%20b", referrer: "https://news.example.com/story?id=9#top" };

describe("hiddenValue", () => {
  it("reads the page, a parameter in its address, or the referrer", () => {
    expect(hiddenValue("page", undefined, page)).toBe("https://example.org/join");
    expect(hiddenValue("param", "utm_source", page)).toBe("newsletter");
    expect(hiddenValue("param", "ref", page)).toBe("a b");
    expect(hiddenValue("param", "missing", page)).toBe("");
    expect(hiddenValue("referrer", undefined, page)).toBe("https://news.example.com/story");
    expect(hiddenValue("referrer", undefined, { ...page, referrer: "" })).toBe("");
  });

  it("sends nothing for a fixed value (the server supplies it), and cuts long values", () => {
    expect(hiddenValue("fixed", undefined, page)).toBe("");
    expect(hiddenValue("param", "x", { ...page, search: `?x=${"y".repeat(900)}` })).toHaveLength(500);
  });

  it("drops the query and fragment from an address", () => {
    expect(cleanUrl("https://a.org/p?token=secret#frag")).toBe("https://a.org/p");
    expect(cleanUrl("not a url")).toBe("");
  });
});

describe("solveChallenge", () => {
  const make = (n: number, maxnumber: number) => {
    const salt = "abcdef?form=1&expires=9999999999";
    return { algorithm: "SHA-256" as const, challenge: createHash("sha256").update(salt + n).digest("hex"), maxnumber, salt, signature: "sig" };
  };

  it("finds the number and returns the answer the server expects", async () => {
    const answer = await solveChallenge(make(1234, 5000));
    expect(answer).not.toBeNull();
    expect(JSON.parse(atob(answer as string))).toMatchObject({ algorithm: "SHA-256", number: 1234, signature: "sig" });
  });

  it("finds a number at the very start and the very end of the range", async () => {
    expect(JSON.parse(atob((await solveChallenge(make(0, 600))) as string)).number).toBe(0);
    expect(JSON.parse(atob((await solveChallenge(make(600, 600))) as string)).number).toBe(600);
  });

  it("gives up cleanly when the number is out of range or the signal is aborted", async () => {
    expect(await solveChallenge(make(900, 600))).toBeNull();
    const controller = new AbortController();
    controller.abort();
    expect(await solveChallenge(make(10, 600), controller.signal)).toBeNull();
  });
});
