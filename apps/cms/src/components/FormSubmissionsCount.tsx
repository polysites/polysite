"use client";

import { Link } from "@payloadcms/ui";
import React, { useEffect, useState } from "react";

// The "Submissions" column in the forms list: how many submissions that form holds,
// linking to them. Shows a dash when the signed-in role can't read submissions.
export function FormSubmissionsCount({ rowData }: { rowData?: { id?: string | number } }) {
  const id = rowData?.id;
  const [total, setTotal] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    if (id === undefined || id === null) return;
    let live = true;
    fetch(`/api/form-submissions?where[form][equals]=${encodeURIComponent(String(id))}&limit=1&depth=0&select[createdAt]=true`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (live) setTotal(typeof body?.totalDocs === "number" ? body.totalDocs : null);
      })
      .catch(() => {
        if (live) setTotal(null);
      });
    return () => {
      live = false;
    };
  }, [id]);

  if (total === undefined) return <span style={{ opacity: 0.5 }}>…</span>;
  if (total === null) return <span>-</span>;
  return (
    <Link href={`/admin/collections/form-submissions?where[form][equals]=${encodeURIComponent(String(id))}`} prefetch={false}>
      {total === 1 ? "1 submission" : `${total} submissions`}
    </Link>
  );
}
