"use client";

import { Link } from "@payloadcms/ui";
import React, { useEffect, useState } from "react";

import { ExportControls } from "./FormExport";

// The box at the top of a form's own screen: how many people have sent it, a link to
// read them, and the CSV export. Counts are read through the signed-in person's own
// access, so a role that can't read submissions sees no box at all.
const formIdFromPath = () => /\/collections\/forms\/([^/?#]+)/.exec(window.location.pathname)?.[1] ?? null;

async function count(formId: string, extra = ""): Promise<number | null> {
  try {
    const res = await fetch(
      `/api/form-submissions?where[form][equals]=${encodeURIComponent(formId)}${extra}&limit=1&depth=0&select[createdAt]=true`,
      { credentials: "include" },
    );
    if (!res.ok) return null;
    const body = await res.json();
    return typeof body.totalDocs === "number" ? body.totalDocs : null;
  } catch {
    return null;
  }
}

const since = (days: number) => `&where[createdAt][greater_than_equal]=${encodeURIComponent(new Date(Date.now() - days * 86_400_000).toISOString())}`;

const num = { fontSize: "1.4rem", fontWeight: 600, lineHeight: 1.1 };
const caption = { fontSize: "0.8rem", opacity: 0.7 };

export function FormSubmissionsSummary() {
  const [formId, setFormId] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ last7: number; last30: number; total: number } | null>(null);

  useEffect(() => {
    const id = formIdFromPath();
    if (!id || id === "create") return;
    let live = true;
    Promise.all([count(id, since(7)), count(id, since(30)), count(id)]).then(([last7, last30, total]) => {
      if (!live || last7 === null || last30 === null || total === null) return;
      setFormId(id);
      setCounts({ last7, last30, total });
    });
    return () => {
      live = false;
    };
  }, []);

  if (!formId || !counts) return null;

  return (
    <div style={{ margin: "0 0 1.5rem", padding: "0.9rem 1rem", border: "1px solid var(--theme-elevation-150)", borderRadius: 4 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem 2.5rem" }}>
        <div>
          <div style={num}>{counts.last7}</div>
          <div style={caption}>submissions, last 7 days</div>
        </div>
        <div>
          <div style={num}>{counts.last30}</div>
          <div style={caption}>last 30 days</div>
        </div>
        <div>
          <div style={num}>{counts.total}</div>
          <div style={caption}>held in total</div>
        </div>
        <Link href={`/admin/collections/form-submissions?where[form][equals]=${encodeURIComponent(formId)}`} prefetch={false} style={{ marginLeft: "auto" }}>
          View submissions
        </Link>
      </div>
      <div style={{ marginTop: "0.9rem", paddingTop: "0.9rem", borderTop: "1px solid var(--theme-elevation-100)" }}>
        <ExportControls formId={formId} />
      </div>
    </div>
  );
}
