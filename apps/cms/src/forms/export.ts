import type { Endpoint, PayloadRequest, Where } from "payload";

import { type FormField, inputFields } from "./validateSubmission";

// A form's submissions as a spreadsheet:
//
//   GET /api/form-export/:id            every submission of that form
//   GET /api/form-export/:id?from=YYYY-MM-DD&to=YYYY-MM-DD   within a date range
//
// One row per submission, one column per field of the form, in the form's order.
// Anyone who can read the form's submissions can export them (no separate
// permission): the endpoint reads through the signed-in user's own access, so it
// can never return more than the list in the admin would.

const PAGE_SIZE = 500;
const BOM = "﻿"; // makes Excel read the file as UTF-8, so accents survive

export interface SubmissionDoc {
  createdAt?: string;
  submissionData?: { field?: string | null; value?: string | null }[] | null;
  consent?: { given?: boolean | null; at?: string | null } | null;
}

/**
 * One CSV cell. Quotes anything containing a comma, quote or line break, and
 * defuses spreadsheet formulas: a cell starting with = + - @ (or a tab or
 * carriage return) is prefixed with an apostrophe so it opens as text, not as a
 * formula someone typed into a public form.
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvLine(cells: unknown[]): string {
  return cells.map(csvCell).join(",") + "\r\n";
}

export function exportColumns(fields: FormField[] | undefined): { name: string; label: string }[] {
  return inputFields(fields).map((f) => ({ name: f.name as string, label: f.label || (f.name as string) }));
}

export function headerRow(columns: { label: string }[]): string {
  return csvLine(["Submitted at (UTC)", ...columns.map((c) => c.label), "Other answers", "Consent given", "Consent recorded at (UTC)"]);
}

const yesNo = (value: string) => (value === "true" ? "Yes" : value === "false" ? "No" : value);

export function submissionRow(columns: { name: string }[], doc: SubmissionDoc): string {
  const answers = new Map<string, string>();
  for (const row of doc.submissionData ?? []) {
    if (row?.field) answers.set(row.field, row.value ?? "");
  }
  const known = new Set(columns.map((c) => c.name));
  // Answers to a field that has since been removed from the form are kept, not dropped.
  const other = [...answers].filter(([name]) => !known.has(name)).map(([name, value]) => `${name}: ${yesNo(value)}`);
  return csvLine([
    doc.createdAt ?? "",
    ...columns.map((c) => yesNo(answers.get(c.name) ?? "")),
    other.join("; "),
    doc.consent?.given === true ? "Yes" : doc.consent?.given === false ? "No" : "",
    doc.consent?.at ?? "",
  ]);
}

/** A safe file name: "Join the movement" -> "join-the-movement-submissions-2026-10-07.csv". */
export function exportFileName(title: string | undefined, now = new Date()): string {
  const slug = (title ?? "form")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "form"}-submissions-${now.toISOString().slice(0, 10)}.csv`;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The start and end of the range as ISO times, or an error message. */
export function dateRange(from: string | null, to: string | null): { gte?: string; lte?: string } | string {
  const range: { gte?: string; lte?: string } = {};
  if (from) {
    if (!DAY.test(from) || Number.isNaN(Date.parse(from))) return "The start date must look like 2026-10-07.";
    range.gte = `${from}T00:00:00.000Z`;
  }
  if (to) {
    if (!DAY.test(to) || Number.isNaN(Date.parse(to))) return "The end date must look like 2026-10-07.";
    range.lte = `${to}T23:59:59.999Z`;
  }
  if (range.gte && range.lte && range.gte > range.lte) return "The start date is after the end date.";
  return range;
}

function fail(status: number, message: string): Response {
  return Response.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
}

export const formExportEndpoint: Endpoint = {
  path: "/form-export/:id",
  method: "get",
  handler: async (req: PayloadRequest) => {
    if (!req.user) return fail(401, "Sign in first.");
    const id = (req.routeParams as { id?: string } | undefined)?.id;
    if (!id) return fail(400, "Missing form.");

    const url = new URL(req.url ?? "http://localhost");
    const range = dateRange(url.searchParams.get("from"), url.searchParams.get("to"));
    if (typeof range === "string") return fail(400, range);

    // Read through the caller's own access, so a form (or its submissions) they can't open is a 404/403.
    let form: { id: string | number; title?: string; fields?: FormField[] };
    try {
      form = (await req.payload.findByID({ collection: "forms", id, depth: 0, user: req.user, overrideAccess: false })) as typeof form;
    } catch {
      return fail(404, "That form wasn't found.");
    }

    const where: Where = {
      and: [
        { form: { equals: form.id } },
        ...(range.gte ? [{ createdAt: { greater_than_equal: range.gte } }] : []),
        ...(range.lte ? [{ createdAt: { less_than_equal: range.lte } }] : []),
      ],
    };

    // Ask for the first page now so a role with no access gets a clear refusal instead of an empty file.
    let first;
    try {
      first = await req.payload.find({ collection: "form-submissions", where, sort: "createdAt", limit: PAGE_SIZE, page: 1, depth: 0, user: req.user, overrideAccess: false });
    } catch {
      return fail(403, "You don't have access to this form's submissions.");
    }

    const columns = exportColumns(form.fields);
    const encoder = new TextEncoder();
    let page = 1;
    let current = first;
    let sent = 0;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode(BOM + headerRow(columns)));
      },
      async pull(controller) {
        try {
          if (current.docs.length === 0) {
            req.payload.logger.info({ msg: "Form submissions exported", userId: req.user?.id, formId: form.id, rows: sent });
            controller.close();
            return;
          }
          controller.enqueue(encoder.encode(current.docs.map((d) => submissionRow(columns, d as SubmissionDoc)).join("")));
          sent += current.docs.length;
          if (!current.hasNextPage) {
            req.payload.logger.info({ msg: "Form submissions exported", userId: req.user?.id, formId: form.id, rows: sent });
            controller.close();
            return;
          }
          page += 1;
          current = await req.payload.find({ collection: "form-submissions", where, sort: "createdAt", limit: PAGE_SIZE, page, depth: 0, user: req.user, overrideAccess: false });
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFileName(form.title)}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
};
