// A plugin can say which core versions it works with, in its manifest: "requires": { "polysite": ">=0.1.0 <0.3.0" }.
// Space-separated comparators (>=, >, <=, <, =), all of which must hold. discoverPlugins() skips a plugin that does not
// fit, with this message, instead of letting it fail later in some less obvious way.
// Deliberately minimal: no ^ or ~, no "||". The running core's version is POLYSITE_VERSION, set in the released images; a
// development build ("dev", or anything that is not a version) accepts every plugin. A pre-release core (0.2.0-beta.1)
// is compared as its release (0.2.0), so ">=0.2.0" is satisfied by the betas leading to it.

type Triple = [number, number, number];

const parse = (v: string): Triple | null => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

const compare = (a: Triple, b: Triple): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** null when the plugin may load; otherwise a sentence saying why not. */
export function checkRequires(range: unknown, coreVersion: string | undefined): string | null {
  if (range === undefined || range === null || range === "") return null;
  if (typeof range !== "string") return `"requires.polysite" must be a string such as ">=0.1.0"`;
  const core = coreVersion ? parse(coreVersion) : null;
  const comparators = range.trim().split(/\s+/);
  const wanted: Array<[string, Triple]> = [];
  for (const c of comparators) {
    const m = /^(>=|<=|>|<|=)?(.+)$/.exec(c);
    const v = m ? parse(m[2]) : null;
    if (!m || !v) return `"requires.polysite" has a part it cannot read: "${c}" (use >=, >, <=, < or = with x.y.z)`;
    wanted.push([m[1] ?? "=", v]);
  }
  if (!core) return null; // a development build
  for (const [op, v] of wanted) {
    const d = compare(core, v);
    const ok = op === ">=" ? d >= 0 : op === ">" ? d > 0 : op === "<=" ? d <= 0 : op === "<" ? d < 0 : d === 0;
    if (!ok) return `it needs Polysite ${range}, and this is ${coreVersion}`;
  }
  return null;
}
