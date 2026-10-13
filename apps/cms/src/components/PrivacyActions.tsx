"use client";

import { toast, useConfig, useDocumentInfo, useFormFields, useFormModified } from "@payloadcms/ui";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

// The working buttons on a Privacy Request: find what is held about the person,
// download it to send to them, and (for erasure requests) delete it. The endpoints
// behind them (privacy/endpoints.ts) re-check the user's role and only touch the
// request's own site.
export function PrivacyActions() {
  const { id } = useDocumentInfo();
  const { config } = useConfig();
  const router = useRouter();
  const modified = useFormModified();
  const [busy, setBusy] = useState<"" | "find" | "export" | "erase">("");
  const [found, setFound] = useState<{ count: number; byForm: Record<string, number> } | null>(null);

  const { email, type, status } = useFormFields(([fields]) => ({
    email: fields.requesterEmail?.value as string | undefined,
    type: fields.type?.value as string | undefined,
    status: fields.status?.value as string | undefined,
  }));

  const api = `${config.routes.api}/privacy/requests/${id}`;
  const canErase = type === "erasure" || type === "withdraw-consent";

  async function call(action: "find" | "export" | "erase") {
    setBusy(action);
    try {
      const res = await fetch(`${api}/${action}`, { method: "POST", credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.message ?? "That didn't work.");
        return;
      }
      if (action === "export") {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `personal-information-request-${id}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Downloaded. Check it before you send it on.");
      } else if (action === "find") {
        setFound(await res.json());
      } else {
        const body = await res.json();
        toast.success(`Deleted ${body.erased} submission(s).`);
        setFound(null);
        router.refresh();
      }
    } finally {
      setBusy("");
    }
  }

  function erase() {
    const n = found?.count;
    const sure = window.confirm(
      `Delete ${n != null ? `the ${n} submission(s)` : "every submission"} for ${email} from this site? This can't be undone, and the email address is removed from this request afterwards.`,
    );
    if (sure) void call("erase");
  }

  if (!id) return <p style={{ marginBottom: "1rem" }}>Save the request first, then use the buttons here to find, export or delete the person&apos;s information.</p>;
  if (!email) {
    return (
      <p style={{ marginBottom: "1rem" }}>
        {status === "completed" ? "Done: the person's information was deleted and their email address was removed from this request." : "Add the person's email address above, then save."}
      </p>
    );
  }

  const disabled = busy !== "" || modified;
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <p style={{ margin: "0 0 0.75rem", fontWeight: 600 }}>Work this request</p>
      {modified ? <p style={{ margin: "0 0 0.75rem" }}>Save your changes first. These buttons use the saved request.</p> : null}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" className="btn btn--style-secondary btn--size-small" disabled={disabled} onClick={() => call("find")}>
          {busy === "find" ? "Searching…" : "Find their information"}
        </button>
        <button type="button" className="btn btn--style-secondary btn--size-small" disabled={disabled} onClick={() => call("export")}>
          {busy === "export" ? "Preparing…" : "Download a copy"}
        </button>
        {canErase ? (
          <button type="button" className="btn btn--style-primary btn--size-small" disabled={disabled} onClick={erase}>
            {busy === "erase" ? "Deleting…" : "Delete their information"}
          </button>
        ) : null}
      </div>
      {found ? (
        <p style={{ margin: "0.75rem 0 0" }}>
          {found.count === 0
            ? "No form submissions contain that email address."
            : `${found.count} submission(s) found: ${Object.entries(found.byForm)
                .map(([form, n]) => `${form} (${n})`)
                .join(", ")}.`}
        </p>
      ) : null}
      <p style={{ margin: "0.75rem 0 0", opacity: 0.8, fontSize: "0.85rem" }}>
        Matches form submissions on this site by email address. Information a person typed into a free-text box without their email beside it,
        and information held outside Polysite (inboxes, spreadsheets), has to be handled by hand.
      </p>
    </div>
  );
}
