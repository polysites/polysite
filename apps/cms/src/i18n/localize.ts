import type { Field } from "payload";

import { isDefaultLanguageHere } from "./registry";

// Marks the text a person would translate as translatable, and leaves everything else shared between languages: addresses,
// links, identifiers, colours, numbers, relations and uploads. Walks the whole field tree (blocks, arrays, groups, tabs,
// rows) so a block definition does not have to be edited field by field. Containers themselves are never made translatable,
// only their text, so the structure and order of blocks stays shared between languages.
const TEXT_TYPES = new Set(["text", "textarea", "richText"]);

// Names that hold something that is not prose, whatever their type.
export const NOT_PROSE = /(^|[a-z])(Href|Url|Link|Email|Slug|Anchor|Icon|Id)$|^(href|url|link|email|slug|anchor|icon|id|blockName|blockType)$/;

// "Nothing written": no value, an empty string, or a rich text with no words and nothing else in it.
export function isBlank(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value !== "object") return false;
  const text = JSON.stringify(value);
  return !/"text":"[^"]/.test(text) && !/"type":"(upload|block|inlineBlock|relationship|horizontalrule|link|autolink)"/.test(text);
}

// A required field stays required in the site's default language only. Payload would otherwise ask for it in every language
// being saved, which makes a first translation impossible until every required block field has been copied over.
export function relaxRequired(field: Field): Field {
  if (!("required" in field) || !field.required) return field;
  const { required: _required, validate, ...rest } = field as unknown as { required?: boolean; validate?: (value: unknown, options: Record<string, unknown>) => unknown };
  void _required;
  return {
    ...rest,
    validate: async (value: unknown, options: Record<string, unknown>) => {
      if (isBlank(value) && (await isDefaultLanguageHere(options as never))) {
        const t = (options.req as { t?: (key: string) => string } | undefined)?.t;
        return t?.("validation:required") ?? "This field is required.";
      }
      return validate ? validate(value, options) : true;
    },
  } as Field;
}

export const isTranslatable = (field: Field): boolean =>
  "name" in field && TEXT_TYPES.has(field.type) && !NOT_PROSE.test(field.name) && !("virtual" in field && field.virtual) && !("hidden" in field && field.hidden);

// Translates only the named top-level fields (and, for containers, the text inside them), leaving the rest of the list alone.
export function localizeNamed(fields: Field[], names: string[]): Field[] {
  return fields.map((field) => ("name" in field && names.includes(field.name) ? localizeFields([field])[0] : field));
}

// One field, made translatable the same way (for fields defined by hand where the list helpers don't reach).
export const translatable = (field: Field): Field => localizeFields([field])[0]!;

export function localizeFields(fields: Field[]): Field[] {
  return fields.map((field) => {
    if (field.type === "tabs") {
      return { ...field, tabs: field.tabs.map((tab) => ({ ...tab, fields: localizeFields(tab.fields) })) } as Field;
    }
    if (field.type === "blocks") {
      return { ...field, blocks: field.blocks.map((block) => ({ ...block, fields: localizeFields(block.fields) })) } as Field;
    }
    if ("fields" in field && Array.isArray(field.fields)) {
      return { ...field, fields: localizeFields(field.fields as Field[]) } as Field;
    }
    if (isTranslatable(field)) return relaxRequired({ ...field, localized: true } as Field);
    return field;
  });
}
