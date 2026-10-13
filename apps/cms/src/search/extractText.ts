import { NOT_PROSE } from "../i18n/localize";

// Turns a document into the plain text the site-URL index keeps for visitor search (`site-urls.searchText`). It walks the
// document by its collection's field list, so it needs no knowledge of any collection: pages (blocks), a content-type plugin's
// rich text, arrays, groups and tabs all work the same way. Only prose goes in: text, textarea and rich text fields.
// Never in: a field that is hidden, virtual, or has its own read rule (an editor's note, anything not meant for visitors),
// addresses and identifiers (see NOT_PROSE), relations, uploads, selects, numbers, code and JSON.

/** The most text stored per entry and language, in characters (about 50 KB for Latin scripts). Longer text is cut at a word. */
export const MAX_SEARCH_TEXT = 50_000;

// A collection can opt out, or leave fields out, with `custom.polysite.searchText = false | { exclude: ["fieldName"] }`.
export interface SearchTextOption {
  exclude?: string[];
}

interface FieldLike {
  type: string;
  name?: string;
  fields?: FieldLike[];
  blocks?: { slug: string; fields: FieldLike[] }[];
  tabs?: { name?: string; fields: FieldLike[] }[];
  hidden?: boolean;
  virtual?: unknown;
  access?: { read?: unknown };
}

const MAX_DEPTH = 12;
// Rich text nodes that continue a line; every other element (paragraph, heading, list item, table cell...) starts a new one.
const INLINE = new Set(["text", "link", "autolink", "mark", "tab", "linebreak"]);
const SKIP_NODES = new Set(["upload", "relationship", "horizontalrule"]);
const LOOSE_SKIP = /^(id|blockType|blockName|_status|createdAt|updatedAt)$/;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Lexical rich text as plain text: the words only, one space between blocks, nothing of the markup. */
export function flattenRichText(value: unknown, budget = MAX_SEARCH_TEXT * 2): string {
  let used = 0;
  const walk = (node: unknown, depth: number): string => {
    if (!isObject(node) || depth > 40 || used > budget) return "";
    const type = typeof node.type === "string" ? node.type : "";
    if (type === "text") {
      const text = typeof node.text === "string" ? node.text : "";
      used += text.length;
      return text;
    }
    if (type === "linebreak" || type === "tab") return " ";
    if (SKIP_NODES.has(type)) return " ";
    // A block or inline block placed inside the text: its field values, with no knowledge of the block's definition.
    if (type === "block" || type === "inlineBlock") return ` ${loose(node.fields, 0)} `;
    const inner = Array.isArray(node.children) ? node.children.map((c) => walk(c, depth + 1)).join("") : "";
    return INLINE.has(type) ? inner : ` ${inner} `;
  };
  const root = isObject(value) && isObject(value.root) ? value.root : value;
  return walk(root, 0);
}

// Strings of a value whose definition is unknown (a block inside rich text): prose-looking keys only, bounded in depth.
function loose(value: unknown, depth: number): string {
  if (typeof value === "string") return value;
  if (depth > 6) return "";
  if (Array.isArray(value)) return value.map((v) => loose(v, depth + 1)).join(" ");
  if (!isObject(value)) return "";
  if (isObject(value.root) && Array.isArray(value.root.children)) return flattenRichText(value);
  return Object.entries(value)
    .filter(([key]) => !NOT_PROSE.test(key) && !LOOSE_SKIP.test(key))
    .map(([, v]) => loose(v, depth + 1))
    .join(" ");
}

const hasOwnReadRule = (field: FieldLike): boolean => field.access?.read !== undefined;
const isPublicProse = (field: FieldLike): boolean => !field.hidden && !field.virtual && !hasOwnReadRule(field);

function collect(fields: FieldLike[] | undefined, data: unknown, out: string[], depth: number, skip: Set<string>): void {
  if (!Array.isArray(fields) || !isObject(data) || depth > MAX_DEPTH) return;
  for (const field of fields) {
    if (!field || typeof field.type !== "string") continue;
    const name = field.name;
    if (name && skip.has(name)) continue;
    if (field.type === "tabs") {
      for (const tab of field.tabs ?? []) {
        if (tab.name) collect(tab.fields, data[tab.name], out, depth + 1, new Set());
        else collect(tab.fields, data, out, depth + 1, skip);
      }
      continue;
    }
    if (!name) {
      // Layout only (row, collapsible): the same data, one level deeper.
      if (field.fields) collect(field.fields, data, out, depth + 1, skip);
      continue;
    }
    if (!isPublicProse(field)) continue;
    const value = data[name];
    if (value === undefined || value === null) continue;
    switch (field.type) {
      case "text":
      case "textarea":
        if (!NOT_PROSE.test(name) && typeof value === "string") out.push(value);
        break;
      case "richText":
        out.push(flattenRichText(value));
        break;
      case "group":
        collect(field.fields, value, out, depth + 1, new Set());
        break;
      case "array":
        if (Array.isArray(value)) for (const row of value) collect(field.fields, row, out, depth + 1, new Set());
        break;
      case "blocks":
        if (Array.isArray(value)) {
          for (const row of value) {
            const block = field.blocks?.find((b) => b.slug === (isObject(row) ? row.blockType : undefined));
            if (block) collect(block.fields, row, out, depth + 1, new Set());
          }
        }
        break;
      default:
        break;
    }
  }
}

/** One line of plain text: control characters become spaces, runs of whitespace collapse, cut at a word at `max` characters. */
export function tidy(text: string, max = MAX_SEARCH_TEXT): string {
  const flat = text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.8 ? cut.slice(0, space) : cut).trim();
}

/**
 * The searchable text of a document. `fields` is the collection's field list, `option` its `custom.polysite.searchText`
 * (`false` leaves the collection out). The title and the slug are not included: the index holds those itself.
 */
export function extractSearchText(doc: unknown, fields: unknown, option?: boolean | SearchTextOption | null): string {
  if (option === false || !isObject(doc)) return "";
  const skip = new Set(["title", "slug", ...(isObject(option) && Array.isArray(option.exclude) ? option.exclude : [])]);
  const parts: string[] = [];
  collect(fields as FieldLike[], doc, parts, 0, skip);
  return tidy(parts.join(" "));
}
