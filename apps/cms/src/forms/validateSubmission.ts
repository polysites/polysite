// Checks what a visitor submitted against the form an editor built, on the server.
// The form-builder plugin stores whatever it is given, so without this a public
// endpoint would accept any field name, any value, any size.

export interface FormField {
  blockType: string;
  name?: string;
  label?: string;
  required?: boolean;
  options?: { label?: string; value?: string }[];
  /** Hidden fields only: where the page gets the value (see hiddenField.ts), and the fixed text or parameter name. */
  source?: string;
  value?: string;
}

export type SubmissionRow = { field: string; value: string };
export type ValidationResult =
  | { ok: true; rows: SubmissionRow[] }
  | { ok: false; errors: Record<string, string> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SHORT = 500;
const MAX_LONG = 5000;
const NUMBER = /^-?\d+(\.\d+)?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Field types that collect a value. `message` is display-only text. */
const INPUT_TYPES = new Set(["text", "textarea", "email", "number", "select", "radio", "checkbox", "date", "state", "country", "hidden"]);

export function inputFields(fields: FormField[] | undefined): FormField[] {
  return (fields ?? []).filter((f) => f.name && INPUT_TYPES.has(f.blockType));
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

/**
 * Validates `data` (an object of field name to value) against `fields`.
 * Unknown names are ignored, never stored. Returns the rows to save, in the
 * order the form defines them, or one message per failing field.
 */
export function validateSubmission(fields: FormField[] | undefined, data: unknown): ValidationResult {
  const input = (data && typeof data === "object" && !Array.isArray(data) ? data : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const rows: SubmissionRow[] = [];

  for (const field of inputFields(fields)) {
    const name = field.name as string;
    const label = field.label || name;
    const raw = input[name];

    if (field.blockType === "hidden") {
      // The page fills these in, so they are untrusted text: never required, cut to length rather
      // than refused. A fixed value comes from the form itself, whatever the browser sent.
      const text = asString(field.source === "fixed" ? field.value : raw).slice(0, MAX_SHORT);
      if (text) rows.push({ field: name, value: text });
      continue;
    }

    if (field.blockType === "checkbox") {
      const checked = raw === true || raw === "true" || raw === "on" || raw === 1 || raw === "1";
      if (field.required && !checked) errors[name] = `${label} is required.`;
      else rows.push({ field: name, value: checked ? "true" : "false" });
      continue;
    }

    let value = asString(raw);
    if (!value) {
      if (field.required) errors[name] = `${label} is required.`;
      continue;
    }

    const limit = field.blockType === "textarea" ? MAX_LONG : MAX_SHORT;
    if (value.length > limit) {
      errors[name] = `${label} is too long (${limit} characters at most).`;
      continue;
    }

    switch (field.blockType) {
      case "email":
        if (!EMAIL.test(value)) errors[name] = "Enter a valid email address.";
        else value = value.toLowerCase(); // kept lower-cased so a person can be found by their address later
        break;
      case "number":
        if (!NUMBER.test(value)) errors[name] = `${label} must be a number.`;
        break;
      case "date":
        if (!DATE.test(value) || Number.isNaN(Date.parse(value))) errors[name] = `${label} must be a date.`;
        break;
      case "select":
      case "radio":
        if (!(field.options ?? []).some((o) => o.value === value)) errors[name] = `Choose one of the options for ${label}.`;
        break;
      default:
        break;
    }
    if (!errors[name]) rows.push({ field: name, value });
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, rows };
}
