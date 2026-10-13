"use client";

import { useConfig } from "@payloadcms/ui";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// The site-picker modal behind "Clone to another site", shared by the edit
// view's 3-dot menu (CloneToSiteButton) and the list view's row menu
// (PageRowActions). Rendered through a portal straight into document.body:
// the host popup menu closes on any click inside it, so a picker nested in
// it would never get a chance to render.
//
// Nothing here checks permissions -- the real enforcement is server-side in
// Pages.ts's cloneToSite endpoint; a user without pages:cloneAcrossSites just
// gets a 403 from it.
export function CloneToSiteModal({ id, onClose }: { id: string | number; onClose: () => void }) {
  const { config } = useConfig();
  const [sites, setSites] = useState<{ id: string | number; name: string }[]>([]);
  const [targetSiteId, setTargetSiteId] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`${config.serverURL}${config.routes.api}/sites?limit=100&depth=0`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) =>
        setSites((data.docs ?? []).map((s: { id: string | number; name: string }) => ({ id: s.id, name: s.name }))),
      )
      .catch(() => setSites([]));
  }, [config.serverURL, config.routes.api]);

  const handleClone = async () => {
    if (!targetSiteId) return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch(`${config.serverURL}${config.routes.api}/pages/${id}/clone`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetSiteId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data?.error || "Clone failed.");
        return;
      }
      setStatus("done");
      setMessage(`Cloned as a draft (id ${data.doc.id}) on the target site.`);
    } catch {
      setStatus("error");
      setMessage("Clone failed.");
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--theme-elevation-0, #fff)", color: "var(--theme-elevation-1000, #000)", padding: 24, borderRadius: 8, minWidth: 320 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>Clone this page to another site</h3>
        <p style={{ fontSize: 13 }}>Lands as a draft on the target site, regardless of this page&apos;s current status.</p>
        <select
          value={targetSiteId}
          onChange={(e) => setTargetSiteId(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 12 }}
        >
          <option value="">Select a target site</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn--style-secondary btn--size-small" onClick={onClose}>
            {status === "done" ? "Close" : "Cancel"}
          </button>
          <button
            type="button"
            className="btn btn--style-primary btn--size-small"
            disabled={!targetSiteId || status === "loading" || status === "done"}
            onClick={handleClone}
          >
            {status === "loading" ? "Cloning…" : "Clone"}
          </button>
        </div>
        {message && <p style={{ fontSize: 12, marginTop: 12 }}>{message}</p>}
      </div>
    </div>,
    document.body,
  );
}
