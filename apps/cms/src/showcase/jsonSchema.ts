// A small JSON Schema validator for the one schema the showcase has (themes/docs/showcase.schema.json). It supports exactly the
// keywords that file uses: type, enum, const, properties, required, additionalProperties, items, min/maxItems, min/maxLength,
// pattern, minimum/maximum, $ref into #/$defs, allOf, if/then and oneOf. Written here rather than depending on a library so the
// messages can name the file and the path, and so nothing has to be installed to run the seeder. The schema stays an ordinary
// draft-07 document, so an editor can use it for completion.

export type Schema = {
  [key: string]: unknown;
};

export interface Issue {
  /** Where, like `pages[2].blocks[0].images[1].image` (empty for the whole document). */
  path: string;
  message: string;
}

const typeOf = (value: unknown): string => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
};

const matchesType = (value: unknown, type: string): boolean => {
  const actual = typeOf(value);
  return actual === type || (type === "number" && actual === "integer");
};

const show = (value: unknown): string => {
  const text = JSON.stringify(value);
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
};

function resolveRef(root: Schema, ref: string): Schema {
  if (!ref.startsWith("#/")) throw new Error(`Unsupported $ref "${ref}"`);
  let node: unknown = root;
  for (const part of ref.slice(2).split("/")) {
    node = (node as Record<string, unknown> | undefined)?.[part.replace(/~1/g, "/").replace(/~0/g, "~")];
  }
  if (!node || typeof node !== "object") throw new Error(`Unresolved $ref "${ref}"`);
  return node as Schema;
}

const distance = (a: string, b: string): number => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length]!;
};

/** The known property closest to a misspelt one, when it is close enough to be a typo. */
export function closest(word: string, known: string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = 3;
  for (const candidate of known) {
    const d = distance(word.toLowerCase(), candidate.toLowerCase());
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best;
}

const join = (path: string, key: string | number): string => (typeof key === "number" ? `${path}[${key}]` : path ? `${path}.${key}` : key);

/** Checks `value` against `schema` and returns every problem found (an empty list means valid). */
export function validate(schema: Schema, value: unknown, root: Schema = schema, path = ""): Issue[] {
  const issues: Issue[] = [];
  const add = (message: string) => issues.push({ path, message });

  if (typeof schema.$ref === "string") issues.push(...validate(resolveRef(root, schema.$ref), value, root, path));

  const type = schema.type;
  if (type !== undefined) {
    const types = Array.isArray(type) ? (type as string[]) : [type as string];
    if (!types.some((t) => matchesType(value, t))) {
      add(`must be ${types.length > 1 ? `one of ${types.join(" or ")}` : /^[aeiou]/.test(types[0]!) ? `an ${types[0]}` : `a ${types[0]}`}, found ${typeOf(value)}`);
      return issues;
    }
  }

  if ("const" in schema && JSON.stringify(schema.const) !== JSON.stringify(value)) add(`must be ${show(schema.const)}`);
  if (Array.isArray(schema.enum) && !schema.enum.some((option) => JSON.stringify(option) === JSON.stringify(value))) {
    const options = schema.enum as unknown[];
    const near = typeof value === "string" ? closest(value, options.filter((o): o is string => typeof o === "string")) : undefined;
    add(`${show(value)} is not allowed; use ${options.length > 12 ? `one of ${options.slice(0, 12).map(show).join(", ")}, ...` : `one of ${options.map(show).join(", ")}`}${near ? ` (did you mean ${show(near)}?)` : ""}`);
  }

  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) add(schema.minLength === 1 ? "must not be empty" : `must be at least ${schema.minLength} characters`);
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) add(`is ${value.length} characters; the most allowed is ${schema.maxLength}`);
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern).test(value)) {
      add(`${show(value)} is not in the expected form${typeof schema.description === "string" ? ` (${schema.description})` : ` (pattern ${schema.pattern})`}`);
    }
  }

  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) add(`must be at least ${schema.minimum}`);
    if (typeof schema.maximum === "number" && value > schema.maximum) add(`must be at most ${schema.maximum}`);
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) add(`needs at least ${schema.minItems} item${schema.minItems === 1 ? "" : "s"}`);
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) add(`has ${value.length} items; the most allowed is ${schema.maxItems}`);
    if (schema.items && typeof schema.items === "object") {
      value.forEach((item, index) => issues.push(...validate(schema.items as Schema, item, root, join(path, index))));
    }
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const properties = (schema.properties ?? {}) as Record<string, Schema>;
    for (const name of (schema.required ?? []) as string[]) {
      if (!(name in record) || record[name] === undefined) issues.push({ path: join(path, name), message: "is required" });
    }
    for (const [name, child] of Object.entries(record)) {
      if (name in properties) {
        issues.push(...validate(properties[name]!, child, root, join(path, name)));
      } else if (schema.additionalProperties === false) {
        const near = closest(name, Object.keys(properties));
        issues.push({ path: join(path, name), message: `is not a known property here${near ? ` (did you mean "${near}"?)` : ""}` });
      } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        issues.push(...validate(schema.additionalProperties as Schema, child, root, join(path, name)));
      }
    }
  }

  if (Array.isArray(schema.allOf)) {
    for (const part of schema.allOf as Schema[]) {
      if (part.if && typeof part.if === "object") {
        const holds = validate(part.if as Schema, value, root, path).length === 0;
        if (holds && part.then) issues.push(...validate(part.then as Schema, value, root, path));
        if (!holds && part.else) issues.push(...validate(part.else as Schema, value, root, path));
      } else {
        issues.push(...validate(part, value, root, path));
      }
    }
  }

  if (Array.isArray(schema.oneOf)) {
    const branches = schema.oneOf as Schema[];
    const matching = branches.filter((branch) => validate(branch, value, root, path).length === 0);
    if (matching.length !== 1) {
      const wanted = branches.map((b) => (b.type ? String(b.type) : "an object")).join(" or ");
      add(`must be ${wanted}${matching.length > 1 ? " (it matches more than one choice)" : ""}`);
    }
  }

  return issues;
}

/** One line per problem, naming the file: `showcase/site.json: pages[1].slug: "About Us" is not ...`. */
export function formatIssues(file: string, issues: Issue[]): string[] {
  return issues.map((issue) => `${file}: ${issue.path ? `${issue.path}: ` : ""}${issue.message}`);
}
