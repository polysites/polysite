import { createHmac } from "node:crypto";

import type { FormField, SubmissionRow } from "./validateSubmission";

// What a petition needs on top of an ordinary form: one signature per person, and a public count that costs the database almost nothing
// however many people look at it.

export type DedupeMode = "none" | "email";

/** An email address as the same person would type it twice: no surrounding spaces, no capital letters. */
export function normalizeEmail(raw: string): string {
  return raw.normalize("NFKC").trim().toLowerCase();
}

/** The form's first email field, which is what "one signature per email address" looks at. */
export function emailFieldName(fields: FormField[] | undefined): string | undefined {
  return fields?.find((f) => f.blockType === "email" && f.name)?.name;
}

/**
 * The key two submissions share when they are from the same person, or null when this form does not de-duplicate. It is a keyed hash
 * (HMAC with the server secret, scoped to the form), not the address itself: the submission already holds the address, and a second
 * copy of it in a column of its own would be one more place for it to leak from. The same address on another form gives another key.
 */
export function dedupeKeyFor(
  secret: string,
  formId: string | number,
  fields: FormField[] | undefined,
  rows: SubmissionRow[],
  mode: DedupeMode | null | undefined,
): string | null {
  if (mode !== "email") return null;
  const name = emailFieldName(fields);
  if (!name) return null;
  const value = rows.find((r) => r.field === name)?.value;
  if (!value) return null;
  return createHmac("sha256", secret).update(`dedupe.${formId}.${normalizeEmail(value)}`).digest("hex");
}

/** True when a save failed because the unique index on (form, dedupe key) said this person already signed. */
export function isDuplicateError(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && current; depth++) {
    const e = current as { code?: unknown; message?: unknown; cause?: unknown; data?: { errors?: { path?: unknown }[] } };
    if (e.code === "23505") return true;
    if (typeof e.message === "string" && /duplicate key value|unique constraint/i.test(e.message)) return true;
    // Payload's Postgres adapter turns a unique violation into its own validation error that names the columns ("The following field is
    // invalid: form_id, dedupe_key"). Judge it by that message and the field paths, never by the class name: in a production build the
    // class name is minified (it is "d"), so a check on "ValidationError" passes in development and fails in production.
    const named = [e.message, ...(e.data?.errors ?? []).map((x) => x.path)].filter((x): x is string => typeof x === "string").join(" ");
    if (/is invalid/i.test(named) && /dedupe_?key/i.test(named)) return true;
    if ((e.data?.errors ?? []).some((x) => typeof x.path === "string" && /dedupe_?key/i.test(x.path))) return true;
    current = e.cause;
  }
  return false;
}

/** A small time-limited cache held in memory: right for one server process. */
export class TtlCache<T> {
  private entries = new Map<string, { value: T; expires: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly clock: () => number = Date.now,
    private readonly maxEntries = 1000,
  ) {}

  get(key: string): T | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (hit.expires <= this.clock()) {
      this.entries.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    if (this.entries.size >= this.maxEntries) {
      const now = this.clock();
      for (const [k, v] of this.entries) if (v.expires <= now) this.entries.delete(k);
      if (this.entries.size >= this.maxEntries) this.entries.clear();
    }
    this.entries.set(key, { value, expires: this.clock() + this.ttlMs });
  }
}

/** What the public count endpoint says: the people counted in the database plus an owner-chosen starting number, and the goal if there is one. */
export function publicCount(stored: number, offset: unknown, goal: unknown): { count: number; goal: number | null } {
  const start = typeof offset === "number" && Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  const target = typeof goal === "number" && Number.isFinite(goal) && goal > 0 ? Math.floor(goal) : null;
  return { count: Math.max(0, stored) + start, goal: target };
}
