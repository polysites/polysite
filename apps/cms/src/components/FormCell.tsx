"use client";

import React, { useEffect, useState } from "react";

// The "Form" column in the submissions list. Payload's own relationship cell
// looks the title up through a shared list fetch that is skipped when the list
// is opened with a filter on this very field (the link on each form's screen),
// leaving "<No Form>". This cell resolves the title itself when it isn't already
// in the row.
export function FormCell({ cellData }: { cellData?: unknown }) {
  const object = cellData && typeof cellData === "object" ? (cellData as { id?: string | number; title?: string }) : null;
  const id = object ? object.id : (cellData as string | number | null | undefined);
  const known = object?.title;
  const [title, setTitle] = useState<string | undefined>(known);

  useEffect(() => {
    if (known || id === undefined || id === null || id === "") return;
    let live = true;
    fetch(`/api/forms/${encodeURIComponent(String(id))}?depth=0&select[title]=true`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((doc) => {
        if (live && doc && typeof doc.title === "string") setTitle(doc.title);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id, known]);

  if (id === undefined || id === null || id === "") return <span>-</span>;
  return <span>{title ?? `Form ${id}`}</span>;
}
