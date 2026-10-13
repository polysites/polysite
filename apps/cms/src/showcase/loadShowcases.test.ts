import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadShowcases, MAX_IMAGE_BYTES } from "./loadShowcases";

// The schema lives in the themes repository (themes/docs/showcase.schema.json). The core can be tested without that
// repository, so these tests run only where it is mounted.
const realSchema = path.resolve(process.cwd(), "../../themes/docs/showcase.schema.json");
const haveSchema = fs.existsSync(realSchema);

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "showcase-"));
  if (haveSchema) {
    fs.mkdirSync(path.join(dir, "docs"));
    fs.copyFileSync(realSchema, path.join(dir, "docs", "showcase.schema.json"));
  }
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const minimal = (extra: Record<string, unknown> = {}) => ({
  slug: "demo",
  name: "Demo Studio",
  theme: "demo",
  pages: [{ title: "Home", slug: "home", blocks: [{ blockType: "hero", heading: "Hello" }] }],
  ...extra,
});

function addTheme(name: string, site: unknown, images: Record<string, number> = {}) {
  const base = path.join(dir, `polysite-theme-${name}`, "showcase");
  fs.mkdirSync(path.join(base, "images"), { recursive: true });
  fs.writeFileSync(path.join(base, "site.json"), typeof site === "string" ? site : JSON.stringify(site));
  for (const [file, size] of Object.entries(images)) fs.writeFileSync(path.join(base, "images", file), "x".repeat(size));
}

describe.skipIf(!haveSchema)("loadShowcases", () => {
  const load = (only?: string[]) => loadShowcases({ themesDir: dir, baseDomain: "localhost", only, installedThemes: ["demo", "other"] });

  it("loads a valid showcase and works out its domain", () => {
    addTheme("demo", minimal());
    const result = load();
    expect(result.errors).toEqual([]);
    expect(result.showcases).toHaveLength(1);
    expect(result.showcases[0]!.domain).toBe("demo.localhost");
  });

  it("uses domainPrefix and the base domain", () => {
    addTheme("demo", minimal({ domainPrefix: "beauty" }));
    const result = loadShowcases({ themesDir: dir, baseDomain: "example.test", installedThemes: ["demo"] });
    expect(result.showcases[0]!.domain).toBe("beauty.example.test");
  });

  it("ignores theme folders without a showcase", () => {
    fs.mkdirSync(path.join(dir, "polysite-theme-plain"));
    expect(load().showcases).toEqual([]);
    expect(load().errors).toEqual([]);
  });

  it("names the file and the path of a schema error", () => {
    addTheme("demo", minimal({ pages: [{ title: "Home", slug: "home", blocks: [{ blockType: "hero", headin: "x" }] }] }));
    const { errors } = load();
    expect(errors.join("\n")).toContain("polysite-theme-demo/showcase/site.json: pages[0].blocks[0].heading: is required");
    expect(errors.join("\n")).toContain('pages[0].blocks[0].headin: is not a known property here (did you mean "heading"?)');
  });

  it("reports invalid JSON with the file name", () => {
    addTheme("demo", "{ not json");
    expect(load().errors[0]).toContain("polysite-theme-demo/showcase/site.json: not valid JSON");
  });

  it("reports an unknown block type with the allowed list", () => {
    addTheme("demo", minimal({ pages: [{ title: "Home", slug: "home", blocks: [{ blockType: "carousel" }] }] }));
    expect(load().errors.join("\n")).toContain("pages[0].blocks[0].blockType");
  });

  it("checks a block's fields against its own definition", () => {
    addTheme("demo", minimal({ pages: [{ title: "Home", slug: "home", blocks: [{ blockType: "gallery", columns: 5, images: [{ image: "photo.png" }] }] }] }));
    const text = load().errors.join("\n");
    expect(text).toContain("pages[0].blocks[0].columns");
    expect(text).toContain("pages[0].blocks[0].images[0].image");
  });

  it("requires a front page and checks form keys", () => {
    addTheme("demo", minimal({ pages: [{ title: "About", slug: "about", blocks: [{ blockType: "formEmbed", form: "x" }] }] }));
    const text = load().errors.join("\n");
    expect(text).toContain("no front page");
    expect(text).toContain('no form with the key "x"');
  });

  it("errors when a picture is missing and warns when one is big", () => {
    addTheme("demo", minimal({ pages: [{ title: "Home", slug: "home", blocks: [{ blockType: "hero", heading: "H", image: "images/gone.svg" }, { blockType: "hero", heading: "I", image: "images/big.svg" }] }] }), {
      "big.svg": MAX_IMAGE_BYTES + 10,
    });
    const result = load();
    expect(result.errors.join("\n")).toContain("images/gone.svg: the file does not exist");
    expect(result.warnings.join("\n")).toContain("images/big.svg");
  });

  it("errors on a theme that is not installed", () => {
    addTheme("demo", minimal({ theme: "ghost" }));
    expect(load().errors.join("\n")).toContain('theme: "ghost" is not an installed theme');
  });

  it("selects by theme name or slug and complains about an unknown name", () => {
    addTheme("demo", minimal());
    addTheme("other", minimal({ slug: "second", theme: "other" }));
    expect(load(["other"]).showcases.map((s) => s.theme)).toEqual(["other"]);
    expect(load(["second"]).showcases.map((s) => s.theme)).toEqual(["other"]);
    expect(load(["nope"]).errors[0]).toContain('no showcase named "nope"');
  });

  it("refuses two showcases on one domain", () => {
    addTheme("demo", minimal());
    addTheme("other", minimal({ theme: "other", slug: "two", domainPrefix: "demo" }));
    expect(load().errors.join("\n")).toContain("domain demo.localhost is also used by");
  });
});

describe("loadShowcases without the schema", () => {
  it("says so instead of throwing", () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "showcase-empty-"));
    try {
      const result = loadShowcases({ themesDir: empty, baseDomain: "localhost" });
      expect(result.errors[0]).toContain("cannot read the showcase schema");
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });
});
