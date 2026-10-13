"use client";

import { Link } from "@payloadcms/ui";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";

import { ExportControls } from "./FormExport";

// Above the submissions list when it is opened for one form (from the form's
// Submissions column or summary): says whose submissions these are, and offers the
// CSV export and a way back. With no form in the address it shows nothing.
export function FormSubmissionsHeader() {
  const params = useSearchParams();
  const formId = params.get("where[form][equals]");
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!formId) return;
    let live = true;
    fetch(`/api/forms/${encodeURIComponent(formId)}?depth=0&select[title]=true`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((doc) => {
        if (live) setTitle(typeof doc?.title === "string" ? doc.title : null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [formId]);

  if (!formId) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "0.75rem 1.5rem", margin: "0 0 1.25rem" }}>
      <div>
        <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>Submissions for</div>
        <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{title ?? "this form"}</div>
        <div style={{ fontSize: "0.8rem", opacity: 0.7, marginTop: 2 }}>
          Submissions are a record of what people sent. They can be read and exported, not edited or deleted.
        </div>
        <Link href={`/admin/collections/forms/${encodeURIComponent(formId)}`} prefetch={false} style={{ fontSize: "0.85rem" }}>
          Back to the form
        </Link>
      </div>
      <ExportControls formId={formId} />
    </div>
  );
}
