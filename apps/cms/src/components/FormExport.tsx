"use client";

import React, { useState } from "react";

// "Download CSV" with an optional date range, for one form. A plain link to
// /api/form-export/:id (forms/export.ts): the browser sends the login cookie and
// saves the file, and the server reads through the person's own access.
export function ExportControls({ formId }: { formId: string | number }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  const href = `/api/form-export/${encodeURIComponent(String(formId))}${query ? `?${query}` : ""}`;

  const input = { font: "inherit", padding: "0.3rem 0.4rem", border: "1px solid var(--theme-elevation-150)", borderRadius: 4, background: "var(--theme-input-bg)", color: "var(--theme-text)" };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "0.5rem 0.75rem" }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: "0.75rem", opacity: 0.8 }}>
        From
        <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} style={input} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: "0.75rem", opacity: 0.8 }}>
        To
        <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} style={input} />
      </label>
      <a href={href} download className="btn btn--style-primary btn--size-small" style={{ textDecoration: "none" }}>
        Export CSV
      </a>
    </div>
  );
}
