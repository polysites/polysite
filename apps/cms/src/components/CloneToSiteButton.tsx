"use client";

import { useDocumentInfo } from "@payloadcms/ui";
import { useState } from "react";

import { CloneToSiteModal } from "./CloneToSiteModal";

// A "3-dot menu" item on the Pages edit view -- same admin.components.edit.
// editMenuItems slot @payloadcms/plugin-multi-tenant uses for its own
// "Assign Tenant" action. The picker itself is a modal (CloneToSiteModal),
// not an inline expansion, because the host popup closes on any click inside.
export function CloneToSiteButton() {
  const { id } = useDocumentInfo();
  const [open, setOpen] = useState(false);

  if (!id) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ background: "none", border: "none", width: "100%", textAlign: "left", padding: "8px 16px", cursor: "pointer" }}
      >
        Clone to another site
      </button>
      {open && <CloneToSiteModal id={id} onClose={() => setOpen(false)} />}
    </>
  );
}
