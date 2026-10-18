import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The core's own templates and stylesheets use logical directions (start/end), so <html dir="rtl"> flips them with no
// extra CSS. A theme's equivalent is Polysite-themes/scripts/check-rtl.mjs.
const PHYSICAL = [
  /(?<![-\w])(margin|padding)-(left|right)\s*:/,
  /(?<![-\w])border-(left|right)(-width|-color|-style)?\s*:/,
  /(?<![-\w.])(left|right)\s*:\s*[-0-9c]/,
  /text-align\s*:\s*(left|right)/,
  /float\s*:\s*(left|right)/,
  /(?<![-\w:])[mp][lr]-\d|(?<![-\w])text-(left|right)\b/,
];

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if ([".nuxt", ".output", "node_modules"].includes(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(vue|css)$/.test(name)) out.push(full);
  }
  return out;
}

describe("right-to-left readiness", () => {
  it("uses no left/right direction in the core's templates and styles", () => {
    const bad: string[] = [];
    for (const dir of ["components", "layouts", "pages", "assets"]) {
      for (const file of sources(path.resolve(__dirname, "..", dir))) {
        readFileSync(file, "utf8").split(/\r?\n/).forEach((line, i) => {
          if (/rtl-ok|-10000px|left:\s*50%/.test(line)) return;
          if (PHYSICAL.some((re) => re.test(line))) bad.push(`${path.relative(path.resolve(__dirname, ".."), file)}:${i + 1}  ${line.trim()}`);
        });
      }
    }
    expect(bad).toEqual([]);
  });
});
