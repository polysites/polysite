// What a person receives when they ask to see the information held about them.

export interface StoredSubmission {
  id: number | string;
  createdAt?: string;
  form?: { title?: string } | number | string | null;
  submissionData?: { field: string; value: string }[];
  consent?: { given?: boolean | null; statement?: string | null; at?: string | null } | null;
}

export function buildExport(subject: string, submissions: StoredSubmission[], now = new Date()) {
  return {
    generatedAt: now.toISOString(),
    subject,
    scope:
      "Form submissions held by this site's CMS that contain this email address. Information held elsewhere (email inboxes, other systems) is not included.",
    records: submissions.map((s) => ({
      submittedAt: s.createdAt ?? null,
      form: s.form && typeof s.form === "object" ? (s.form.title ?? null) : null,
      answers: Object.fromEntries((s.submissionData ?? []).map((row) => [row.field, row.value])),
      // What the visitor was shown when they submitted, and whether they ticked a consent box.
      consent: { explicit: Boolean(s.consent?.given), statement: s.consent?.statement ?? null, at: s.consent?.at ?? null },
    })),
  };
}
